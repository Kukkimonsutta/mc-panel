import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { status as mcStatus, queryFull } from 'minecraft-server-util';
import config from './config.js';
import { getServerStatus, startServer, stopServer, sendCommand, getContainer, getContainerStats, readServerProperties, writeServerProperties, listBackups, createBackup, deleteBackup, startRestoreBackup, getRestoreStatus, getBackupSchedule, setBackupSchedule, runScheduledBackup, playerAction, listWhitelist, whitelistAction, listBans, tempBanPlayer, unbanPlayer, processExpiredTempBans, readServerIcon, writeServerIcon, getPowerSchedule, setPowerSchedule, runPowerSchedule, initPlayerSessionTracker, getPlayerSessions } from './dockerService.js';

const app = express();
const PORT = config.PORT;

app.disable('x-powered-by');
// The backend is only reachable from the Nginx frontend on the shared Docker
// network, which sets X-Forwarded-For. Trust it so rate limiting sees real IPs.
app.set('trust proxy', true);

// CORS configuration
app.use(cors({
  origin: config.CORS_ORIGIN,
  methods: ['GET', 'POST', 'DELETE'],
  credentials: config.CORS_ORIGIN !== '*'
}));

// JSON body parser (1 MB: enough for the 64x64 icon data URL, small for everything else)
app.use(express.json({ limit: '1mb' }));

// Creamos el servidor HTTP compatible con WebSockets
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: config.CORS_ORIGIN !== '*'
  }
});

// Auth middleware: checks Authorization: Bearer <token> if API_TOKEN is configured
function safeTokenEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Simple in-memory rate limiter for failed authentication attempts (no deps).
// 20 failures per minute per IP -> blocked for 5 minutes.
const failedAuth = new Map(); // ip -> { count, windowStart, blockedUntil }
const AUTH_FAIL_LIMIT = 20;
const AUTH_WINDOW_MS = 60 * 1000;
const AUTH_BLOCK_MS = 5 * 60 * 1000;

function isAuthBlocked(ip) {
  const entry = failedAuth.get(ip);
  if (!entry) return false;
  const now = Date.now();
  if (entry.blockedUntil && now < entry.blockedUntil) return true;
  if (now - entry.windowStart > AUTH_WINDOW_MS) {
    failedAuth.delete(ip);
    return false;
  }
  return false;
}

function recordAuthFailure(ip) {
  const now = Date.now();
  const entry = failedAuth.get(ip);
  if (!entry || now - entry.windowStart > AUTH_WINDOW_MS) {
    failedAuth.set(ip, { count: 1, windowStart: now, blockedUntil: 0 });
    return;
  }
  entry.count += 1;
  if (entry.count >= AUTH_FAIL_LIMIT) {
    entry.blockedUntil = now + AUTH_BLOCK_MS;
    console.warn(`🔒 Demasiados intentos de autenticación fallidos desde ${ip} — bloqueado 5 minutos`);
  }
}

function clearAuthFailures(ip) {
  failedAuth.delete(ip);
}

function authMiddleware(req, res, next) {
  if (!config.API_TOKEN) {
    // No token configured — API is open
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (isAuthBlocked(ip)) {
    return res.status(429).json({ success: false, error: 'Too many failed attempts. Try again later.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    recordAuthFailure(ip);
    return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  if (!safeTokenEqual(token, config.API_TOKEN)) {
    recordAuthFailure(ip);
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }

  clearAuthFailures(ip);
  next();
}

// Apply auth to all /api/* routes except /api/health
app.use('/api/server', authMiddleware);
app.use('/api/server/backups', authMiddleware);

// Socket.IO auth middleware
io.use((socket, next) => {
  if (!config.API_TOKEN) {
    // No token required
    return next();
  }

  const token = socket.handshake.auth?.token;
  if (!token || !safeTokenEqual(token, config.API_TOKEN)) {
    return next(new Error('Authentication error'));
  }

  next();
});

// --- RUTAS API REST ---
app.get('/api/server/status', async (req, res) => {
  // 1. Obtenemos el estado base de Docker (si el contenedor corre)
  const dockerStatus = await getServerStatus();

  // Estructura por defecto si está apagado
  const finalStatus = {
    ...dockerStatus,
    worldName: '',
    onlinePlayers: 0,
    maxPlayers: 10,
    players: []
  };

  const properties = await readServerProperties();
  finalStatus.worldName = properties?.['level-name'] || path.basename(config.WORLD_PATH);

  // 2. Si el contenedor de Docker está activo, le hacemos ping al servidor interno de Minecraft
  if (dockerStatus.running) {
    try {
      // Hacemos ping a localhost (ya que el contenedor expone el puerto al host)
      // Usamos un timeout de 1000ms para evitar que la petición web se quede colgada si Minecraft está iniciando
      const data = await mcStatus(config.MC_HOST, config.MC_STATUS_PORT, { enableSRV: false, timeout: 1000 });
      
      if (data) {
        finalStatus.onlinePlayers = data.players.online;
        finalStatus.maxPlayers = data.players.max;
        
        // Si hay jugadores online, mapeamos sus nombres desde el sample
        if (data.players.sample && Array.isArray(data.players.sample) && data.players.sample.length > 0) {
          finalStatus.players = data.players.sample.map(p => p.name);
        } else {
          finalStatus.players = [];
        }
      }
    } catch (err) {
      // Si falla el ping suele ser porque el contenedor está "running" pero el proceso de Minecraft aún está cargando
      console.log('⏳ El contenedor corre pero el servidor de Minecraft aún no responde a consultas.');
      finalStatus.players = [];
    }
  }

  res.json(finalStatus);
});

app.post('/api/server/start', async (req, res) => {
  const result = await startServer();
  res.json(result);
});

app.post('/api/server/stop', async (req, res) => {
  const result = await stopServer();
  res.json(result);
});

app.post('/api/server/command', async (req, res) => {
  const { command } = req.body;
  
  if (!command || typeof command !== 'string' || command.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Comando vacío o inválido' });
  }
  
  const result = await sendCommand(command.trim());
  res.json(result);
});

app.get('/api/server/query', async (req, res) => {
  const dockerStatus = await getServerStatus();

  if (!dockerStatus.running) {
    return res.json({ running: false, error: 'Servidor apagado' });
  }

  try {
    // Query protocol (UDP) — puede fallar si el puerto UDP no está expuesto
    const data = await queryFull(config.MC_HOST, config.MC_QUERY_PORT, { timeout: 5000 });

    res.json({
      running: true,
      motd: data.motd,
      version: data.version,
      software: data.software,
      plugins: data.plugins,
      map: data.map,
      onlinePlayers: data.players.online,
      maxPlayers: data.players.max,
      players: data.players.list,
      hostIP: data.hostIP,
      hostPort: data.hostPort,
    });
  } catch (err) {
    // Silenciar este ruido cuando el servidor no responde a query o el puerto UDP no está expuesto.
    // El panel sigue funcionando con el estado base y el ping TCP si está disponible.
    try {
      const pingData = await mcStatus(config.MC_HOST, config.MC_STATUS_PORT, { enableSRV: false, timeout: 2000 });
      const playerSample = pingData.players?.sample && Array.isArray(pingData.players.sample) 
        ? pingData.players.sample.map(p => p.name) 
        : [];
      res.json({
        running: true,
        motd: pingData.description || pingData.motd || {},
        version: pingData.version?.name || '',
        software: '',
        plugins: [],
        map: '',
        onlinePlayers: pingData.players?.online || 0,
        maxPlayers: pingData.players?.max || 0,
        players: playerSample,
        _queryMode: 'tcp_fallback',
      });
    } catch (pingErr) {
      console.log('⏳ Ping TCP también falló:', pingErr.message);
      res.json({
        running: true,
        error: `Query UDP: ${err.message}`,
        players: [],
        onlinePlayers: 0,
        maxPlayers: 0,
      });
    }
  }
});

// --- Recursos del contenedor (CPU / RAM) ---
app.get('/api/server/stats', async (req, res) => {
  const stats = await getContainerStats();
  res.json(stats);
});

// --- Historial de logs del contenedor (últimas N líneas) ---
app.get('/api/server/logs', async (req, res) => {
  try {
    let lines = parseInt(req.query.lines, 10);
    if (!Number.isFinite(lines)) lines = 1000;
    lines = Math.max(100, Math.min(lines, 5000));

    const container = getContainer();
    const result = await container.logs({ stdout: true, stderr: true, tail: lines, follow: false });
    let data = '';
    if (result && typeof result.on === 'function') {
      // Stream (dockerode < 4 o con follow)
      result.on('data', (chunk) => { data += chunk.toString('utf8'); });
      await new Promise((resolve, reject) => {
        result.on('end', resolve);
        result.on('error', reject);
      });
    } else {
      // dockerode 4 resuelve con el buffer completo cuando follow: false
      data = Buffer.isBuffer(result) ? result.toString('utf8') : String(result || '');
    }

    const cleaned = data
      .split('\n')
      .map((l) => l.replace(/[\u0000-\u001f]/g, ''))
      .filter((l) => l.trim().length > 0);
    res.json({ success: true, lines: cleaned });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Editor de server.properties ---
app.get('/api/server/properties', async (req, res) => {
  const props = await readServerProperties();
  if (!props) return res.status(500).json({ success: false, error: 'No se pudo leer server.properties' });
  res.json(props);
});

app.post('/api/server/properties', async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'Envía un objeto con las propiedades a actualizar' });
  }
  const result = await writeServerProperties(updates);
  res.json(result);
});

// --- Backups del mundo ---
app.get('/api/server/backups', async (req, res) => {
  const result = await listBackups();
  res.json(result);
});

app.post('/api/server/backups', async (req, res) => {
  const result = await createBackup();
  res.json(result);
});

app.delete('/api/server/backups/:name', async (req, res) => {
  const result = await deleteBackup(req.params.name);
  res.json(result);
});

// --- Programación de backups ---
app.get('/api/server/backups/schedule', async (req, res) => {
  const schedule = await getBackupSchedule();
  res.json({ success: true, schedule });
});

app.post('/api/server/backups/schedule', async (req, res) => {
  const { enabled, intervalHours, retention } = req.body || {};
  const result = await setBackupSchedule({ enabled, intervalHours, retention });
  res.json(result);
});

// --- Restore de backups ---
app.post('/api/server/backups/:name/restore', (req, res) => {
  const result = startRestoreBackup(req.params.name);
  res.json(result);
});

app.get('/api/server/restore/status', (req, res) => {
  res.json(getRestoreStatus());
});

// --- Gestión de jugadores (via RCON) ---
app.post('/api/server/players/action', async (req, res) => {
  const { action, player, reason } = req.body || {};
  if (action === 'unban') {
    res.json(await unbanPlayer(player));
    return;
  }
  const result = await playerAction(action, player, reason);
  res.json(result);
});

// Baneo temporal (horas) con expiración automática
app.post('/api/server/players/tempban', async (req, res) => {
  const { player, reason, hours } = req.body || {};
  const result = await tempBanPlayer(player, reason, hours);
  res.json(result);
});

app.get('/api/server/players/whitelist', async (req, res) => {
  const result = await listWhitelist();
  res.json(result);
});

app.post('/api/server/players/whitelist', async (req, res) => {
  const { action, player } = req.body || {};
  const result = await whitelistAction(action, player);
  res.json(result);
});

app.get('/api/server/players/bans', async (req, res) => {
  const result = await listBans();
  res.json(result);
});

// --- Icono del servidor (server-icon.png, 64x64) ---
app.get('/api/server/icon', async (req, res) => {
  res.json(await readServerIcon());
});

app.post('/api/server/icon', async (req, res) => {
  const { data } = req.body || {};
  const result = await writeServerIcon(data);
  res.json(result);
});

// --- Programación de encendido/apagado del servidor ---
app.get('/api/server/power-schedule', async (req, res) => {
  const schedule = await getPowerSchedule();
  res.json({ success: true, schedule });
});

app.post('/api/server/power-schedule', async (req, res) => {
  const { enabled, events } = req.body || {};
  const result = await setPowerSchedule({ enabled, events });
  res.json(result);
});

// --- Tiempo de conexión por jugador ---
async function getOnlinePlayerNames() {
  try {
    const data = await queryFull(config.MC_HOST, config.MC_QUERY_PORT, { timeout: 5000 });
    return (data.players?.list || []).map((p) => (typeof p === 'string' ? p : p.name));
  } catch {
    try {
      const ping = await mcStatus(config.MC_HOST, config.MC_STATUS_PORT, { enableSRV: false, timeout: 2000 });
      return (ping.players?.sample || []).map((p) => p.name);
    } catch {
      return [];
    }
  }
}

app.get('/api/server/players/sessions', async (req, res) => {
  try {
    const known = getPlayerSessions();
    const online = await getOnlinePlayerNames();
    const status = await getServerStatus();

    // Fallback: si no conocemos el join (backend reiniciado), usamos el arranque del contenedor como cota inferior
    const fallback = status.running && status.startedAt ? Date.parse(status.startedAt) : null;

    const sessions = online.map((name) => {
      if (known[name]) return { name, joinedAt: new Date(known[name]).toISOString(), exact: true };
      return { name, joinedAt: fallback ? new Date(fallback).toISOString() : null, exact: false };
    });
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Backup download endpoint ---
app.get('/api/server/backups/:name/download', async (req, res) => {
  try {
    const { name } = req.params;
    
    // Validate filename (same checks as deleteBackup)
    if (path.basename(name) !== name || !name.endsWith('.tar.gz') || name.includes('..') || name.includes('/') || name.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid backup name' });
    }

    const fp = path.join(config.BACKUP_DIR, name);
    
    // Check file exists
    if (!fs.existsSync(fp)) {
      return res.status(404).json({ success: false, error: 'Backup not found' });
    }

    // Security: resolve real path and verify it's within BACKUP_DIR
    const realPath = await fs.promises.realpath(fp);
    const realBackupDir = await fs.promises.realpath(config.BACKUP_DIR);
    if (!realPath.startsWith(realBackupDir + path.sep) && realPath !== realBackupDir) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Send file
    res.download(fp, name, (err) => {
      if (err) {
        console.error('Download error:', err.message);
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Health Check (no auth required) ---
app.get('/api/health', async (req, res) => {
  try {
    // Basic check: can we reach Docker?
    const container = getContainer();
    await container.inspect();
    res.json({ ok: true, message: 'Server healthy, Docker reachable' });
  } catch (err) {
    res.status(503).json({ ok: false, success: false, error: 'Docker unreachable' });
  }
});

// --- WEBSOCKETS: Transmisión de Logs en vivo ---
io.on('connection', async (socket) => {
  console.log('🔌 Cliente conectado al panel web');
  let logStream = null;
  let reconnectTimer = null;

  async function attachLogStream() {
    try {
      const container = getContainer();
      const status = await getServerStatus();

      if (status.running) {
        // Nos acoplamos a los logs de Docker en tiempo real
        logStream = await container.logs({
          follow: true,
          stdout: true,
          stderr: true,
          tail: 500 // Nos manda las últimas 500 líneas al conectar
        });

        // Escuchamos el flujo de datos y lo enviamos al cliente web
        logStream.on('data', (chunk) => {
          // Limpiamos los caracteres especiales que mete Docker en el buffer
          const cleanLog = chunk.toString('utf8').replace(/[\u0000-\u001f]/g, '');
          socket.emit('log-line', cleanLog);
        });

        logStream.on('end', () => {
          console.log('Log stream ended; will reattach when container restarts');
          logStream = null;
          // Retry in 3 seconds if container is still running
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(attachLogStream, 3000);
        });

        logStream.on('error', (err) => {
          console.error('Log stream error:', err.message);
          logStream = null;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(attachLogStream, 3000);
        });
      } else {
        socket.emit('log-line', '--- El servidor de Minecraft está apagado ---');
        // Retry in 5 seconds if container is not running
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(attachLogStream, 5000);
      }
    } catch (error) {
      socket.emit('log-line', `Error al leer logs: ${error.message}`);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(attachLogStream, 5000);
    }
  }

  attachLogStream();

  // Limpieza cuando el usuario cierra la web
  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado');
    if (logStream && typeof logStream.destroy === 'function') {
      logStream.destroy();
      logStream = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
  });
});

// Programador de backups: verifica cada minuto si toca ejecutar
// También procesa la expiración de baneos temporales y el auto encendido/apagado
const scheduleTimer = setInterval(() => {
  runScheduledBackup().catch((err) => console.error('❌ Scheduled backup error:', err.message));
  processExpiredTempBans().catch((err) => console.error('❌ Temp ban expiry error:', err.message));
  runPowerSchedule().catch((err) => console.error('❌ Power schedule error:', err.message));
}, 60 * 1000);
scheduleTimer.unref();

// --- 404 para rutas API desconocidas ---
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// --- Manejador global de errores (nunca filtrar stack traces) ---
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request body too large' });
  }
  console.error('Unhandled API error:', err?.stack || err);
  const status = err && err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({ success: false, error: 'Internal server error' });
});

// --- Estabilidad: registrar errores de proceso sin tumbar el panel ---
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled promise rejection:', reason?.stack || reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️  Uncaught exception:', err?.stack || err);
});

// --- Apagado ordenado (Docker stop / Ctrl+C) ---
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`🛑 Señal ${signal} recibida, cerrando servidor HTTP...`);
    httpServer.close(() => process.exit(0));
    // Forzar salida si algo se queda colgado
    setTimeout(() => process.exit(0), 5000).unref();
  });
}

// Iniciamos el servidor usando httpServer en lugar de app.listen
httpServer.listen(PORT, () => {
  console.log(`🚀 Panel Backend con WebSockets corriendo en http://localhost:${PORT}`);

  // Arrancar el tracker de sesiones de jugadores (histórico + seguimiento en vivo)
  initPlayerSessionTracker().catch((err) => console.error('❌ Session tracker error:', err.message));

  // Log configuration warnings
  import('./config.js').then(({ logConfigWarnings }) => {
    logConfigWarnings();
  });
});