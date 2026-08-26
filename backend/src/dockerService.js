import Docker from 'dockerode';
import { RCON } from 'minecraft-server-util';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import config from './config.js';

const execAsync = promisify(exec);

// Se conecta al socket local de Docker
const docker = new Docker({ socketPath: config.DOCKER_SOCKET });
const CONTAINER_NAME = config.TARGET_CONTAINER_NAME;

// Configuración RCON
const RCON_HOST = config.RCON_HOST;
const RCON_PORT = config.RCON_PORT;
const RCON_PASSWORD = config.RCON_PASSWORD;

// Backup serialization — single promise chain to prevent concurrent backups
let backupPromise = Promise.resolve();

/**
 * Obtiene el contenedor de Minecraft por su nombre
 */
export function getContainer() {
  return docker.getContainer(CONTAINER_NAME);
}

/**
 * Retorna el estado actual del contenedor (running, stopped, paused, etc.)
 */
export async function getServerStatus() {
  try {
    const container = getContainer();
    const data = await container.inspect();
    return {
      status: data.State.Status,
      running: data.State.Running,
      startedAt: data.State.Running ? data.State.StartedAt : null,
      cpu: 0,
      ram: 0
    };
  } catch (error) {
    return { status: 'offline', running: false, error: 'Contenedor no encontrado' };
  }
}

/**
 * Obtiene estadísticas en vivo del contenedor (CPU, RAM)
 */
export async function getContainerStats() {
  try {
    const container = getContainer();
    const info = await getServerStatus();
    if (!info.running) return { cpu: 0, ramUsed: 0, ramTotal: 0, ramPercent: 0 };

    const containerInfo = await container.inspect();

    // Tomamos un snapshot único del stream de stats
    const stats = await new Promise((resolve, reject) => {
      container.stats({ stream: false }, (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });

    // --- CPU ---
    // Report CPU as a percentage of total host capacity (0-100), not per-core aggregate usage.
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    let cpuPercent = 0;
    if (systemDelta > 0 && cpuDelta > 0) {
      cpuPercent = (cpuDelta / systemDelta) * 100;
    }

    // --- RAM ---
    // Exclude Linux page cache, matching Docker's memory usage display.
    const cache = stats.memory_stats.stats?.cache || 0;
    const ramUsed = Math.max(0, (stats.memory_stats.usage || 0) - cache);
    const dockerLimit = stats.memory_stats.limit || 1;
    const configuredMemory = containerInfo.Config?.Env?.find(value => value.startsWith('MEMORY='))?.slice(7);
    const configuredLimit = parseMemoryLimit(configuredMemory);
    const ramLimit = configuredLimit || dockerLimit;
    const ramPercent = (ramUsed / ramLimit) * 100;

    return {
      cpu: Math.round(cpuPercent * 10) / 10,
      ramUsed: Math.round(ramUsed / 1024 / 1024), // MB
      ramTotal: Math.round(ramLimit / 1024 / 1024), // MB
      ramPercent: Math.round(ramPercent * 10) / 10
    };
  } catch (error) {
    console.error('Error obteniendo stats del contenedor:', error.message);
    return { cpu: 0, ramUsed: 0, ramTotal: 0, ramPercent: 0 };
  }
}

function parseMemoryLimit(value) {
  if (!value) return 0;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*([kmgt]?i?b?)?$/i);
  if (!match) return 0;

  const amount = Number(match[1]);
  const unit = (match[2] || 'b').toLowerCase();
  const multipliers = {
    b: 1,
    k: 1024,
    kb: 1024,
    ki: 1024,
    kib: 1024,
    m: 1024 ** 2,
    mb: 1024 ** 2,
    mi: 1024 ** 2,
    mib: 1024 ** 2,
    g: 1024 ** 3,
    gb: 1024 ** 3,
    gi: 1024 ** 3,
    gib: 1024 ** 3,
    t: 1024 ** 4,
    tb: 1024 ** 4,
    ti: 1024 ** 4,
    tib: 1024 ** 4,
  };

  return amount * (multipliers[unit] || 0);
}

/**
 * Lee server.properties desde el sistema de archivos del host
 */
export async function readServerProperties() {
  try {
    const content = await fs.promises.readFile(config.HOST_PROPS_FILE, 'utf8');
    const props = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.substring(0, eq).trim();
      const value = trimmed.substring(eq + 1).trim();
      props[key] = value;
    }
    // Redact sensitive properties
    delete props['rcon.password'];
    return props;
  } catch (error) {
    console.error('Error leyendo server.properties:', error.message);
    return null;
  }
}

/**
 * Escribe propiedades en server.properties (host) y sincroniza docker-compose.yml
 */
export async function writeServerProperties(updates) {
  try {
    // Validation: reject sensitive and invalid keys
    const FORBIDDEN_KEYS = new Set(['rcon.password']);
    const validKeys = new Set(Object.keys(PROP_TO_ENV));
    
    // Validate all keys in updates
    for (const key of Object.keys(updates)) {
      if (FORBIDDEN_KEYS.has(key)) {
        return { success: false, error: `Cannot modify property: ${key}` };
      }
      // Allow keys that are in the mapping OR that already exist in the file
      const value = updates[key];
      if (typeof value !== 'string') {
        return { success: false, error: `Invalid value type for ${key}` };
      }
      // MOTD may contain real newlines typed in the editor — convert them to literal \n escapes
      if (key === 'motd') {
        updates[key] = value.replace(/\r?\n/g, '\\n');
        if (updates[key].includes('\0')) {
          return { success: false, error: `Invalid character in value for ${key}` };
        }
        continue;
      }
      // Reject values with newlines or NUL characters (injection prevention)
      if (value.includes('\n') || value.includes('\r') || value.includes('\0')) {
        return { success: false, error: `Invalid character in value for ${key}` };
      }
    }

    // 1. Leer archivo actual del host
    const original = await fs.promises.readFile(config.HOST_PROPS_FILE, 'utf8');
    const lines = original.split('\n');
    const result = [];
    const updatedKeys = new Set();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        result.push(line);
        continue;
      }
      const eq = trimmed.indexOf('=');
      if (eq === -1) {
        result.push(line);
        continue;
      }
      const key = trimmed.substring(0, eq).trim();
      if (key in updates) {
        result.push(`${key}=${updates[key]}`);
        updatedKeys.add(key);
      } else {
        result.push(line);
      }
    }
    for (const [key, value] of Object.entries(updates)) {
      if (!updatedKeys.has(key)) {
        result.push(`${key}=${value}`);
      }
    }
    await fs.promises.writeFile(config.HOST_PROPS_FILE, result.join('\n') + '\n', 'utf8');

    // 2. Sincronizar docker-compose.yml (solo las claves que tengan mapeo a env)
    await syncDockerCompose(updates);

    return { success: true };
  } catch (error) {
    console.error('Error escribiendo server.properties:', error.message);
    return { success: false, error: error.message };
  }
}

/** Actualiza las variables de entorno correspondientes en docker-compose.yml */
async function syncDockerCompose(updates) {
  try {
    let compose = await fs.promises.readFile(config.HOST_COMPOSE_FILE, 'utf8');
    for (const [propKey, propValue] of Object.entries(updates)) {
      const envVar = PROP_TO_ENV[propKey];
      if (!envVar) continue;
      // Escape special characters in replacement value to prevent $ interpolation
      const escapedValue = String(propValue).replace(/\$/g, '$$$$').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      // Buscar la línea de la variable de entorno y reemplazarla (match both quoted and unquoted forms)
      const regex = new RegExp(`^([ \\t]*${envVar}:)[ \\t]*(?:"[^"]*"|[^\\s]*)`, 'm');
      if (regex.test(compose)) {
        compose = compose.replace(regex, `$1 "${escapedValue}"`);
      }
    }
    await fs.promises.writeFile(config.HOST_COMPOSE_FILE, compose, 'utf8');
    console.log('📝 docker-compose.yml sincronizado');
  } catch (err) {
    console.error('⚠ No se pudo sincronizar docker-compose.yml:', err.message);
  }
}

/**
 * Enciende el servidor de Minecraft
 */
export async function startServer() {
  try {
    const container = getContainer();
    const info = await getServerStatus();
    
    if (info.running) return { success: true, message: 'El servidor ya está encendido' };
    
    await container.start();
    return { success: true, message: 'Iniciando servidor de Minecraft...' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Apaga el servidor de Minecraft (graceful: runs save-all first)
 */
export async function stopServer() {
  try {
    const container = getContainer();
    const info = await getServerStatus();
    
    if (!info.running) return { success: true, message: 'El servidor ya está apagado' };
    
    // Graceful stop: try to flush world saves via RCON before stopping
    try {
      const client = new RCON();
      await client.connect(RCON_HOST, RCON_PORT);
      await client.login(RCON_PASSWORD);
      await client.execute('save-all');
      await client.execute('save-off');
      await client.close();
      console.log('💾 Mundo guardado antes de detener contenedor');
    } catch (rconErr) {
      console.warn('⚠️  No se pudo ejecutar save-all vía RCON, pero continuando con stop:', rconErr.message);
    }
    
    await container.stop();
    return { success: true, message: 'Deteniendo servidor de Minecraft...' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Envía un comando al servidor de Minecraft.
 * Usa RCON si está configurado (RCON_PASSWORD), si no, usa Docker attach.
 * @param {string} command - Comando a ejecutar (ej: "say Hola mundo")
 */
export async function sendCommand(command) {
  // RCON es la ruta más fiable para esta imagen y para el puerto expuesto por Docker.
  if (RCON_PASSWORD) {
    return sendCommandRCON(command);
  }
  return sendCommandPipe(command);
}

/**
 * Asegura que el pipe de consola exista y sea accesible dentro del contenedor.
 */
async function ensureConsolePipe(container) {
  const exec = await container.exec({
    Cmd: ['sh', '-lc', 'mkdir -p /tmp && rm -f /tmp/minecraft-console-in && mkfifo /tmp/minecraft-console-in && chmod 666 /tmp/minecraft-console-in && ls -l /tmp/minecraft-console-in'],
    User: 'root',
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ hijack: true, stdin: false });
  let output = '';

  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      output += chunk.toString('utf8');
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  return output;
}

/**
 * Envía comando vía el pipe de consola que usa la imagen de Minecraft.
 */
async function sendCommandPipe(command) {
  try {
    const container = getContainer();
    const info = await getServerStatus();

    if (!info.running) {
      return { success: false, error: 'El servidor no está en ejecución' };
    }

    await ensureConsolePipe(container);

    const exec = await container.exec({
      Cmd: ['sh', '-c', 'printf "%s\\n" "$1" > /tmp/minecraft-console-in', 'sh', command],
      User: '1000',
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: false });
    let output = '';

    await new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        output += chunk.toString('utf8');
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    console.log(`📨 [PIPE] Comando enviado: ${command}`);
    return { success: true, command, output };
  } catch (error) {
    console.error(`❌ [PIPE] Error: ${error.message}`);
    return sendCommandAttach(command);
  }
}

/**
 * Envía comando vía RCON (protocolo estándar de Minecraft)
 */
async function sendCommandRCON(command) {
  const client = new RCON();
  try {
    await client.connect(RCON_HOST, RCON_PORT);
    await client.login(RCON_PASSWORD);
    // v5 usa execute() — run() solo retorna un request-id numérico
    const response = await client.execute(command);
    console.log(`📨 [RCON] Comando enviado: ${command} → ${response || '(ok)'}`);
    return { success: true, command, output: response };
  } catch (error) {
    console.error(`❌ [RCON] Error: ${error.message}`);
    // Fallback a Docker attach si RCON falla
    console.log('🔄 Intentando enviar vía Docker attach...');
    return sendCommandAttach(command);
  } finally {
    try {
      await client.close();
    } catch (closeErr) {
      // Ignore close errors
    }
  }
}

/**
 * Envía comando vía Docker attach (escribe directamente al stdin del contenedor)
 */
async function sendCommandAttach(command) {
  try {
    const container = getContainer();
    const info = await getServerStatus();
    
    if (!info.running) {
      return { success: false, error: 'El servidor no está en ejecución' };
    }

    return new Promise((resolve) => {
      // Timeout de seguridad — si no hay respuesta en 5s, asumimos éxito
      const timeout = setTimeout(() => {
        console.log(`📨 Comando enviado (timeout): ${command}`);
        resolve({ success: true, command });
      }, 5000);

      container.attach(
        { stream: true, stdin: true, stdout: true, stderr: true, hijack: true },
        (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            console.error(`❌ Error al adjuntar al contenedor: ${err.message}`);
            resolve({ success: false, error: err.message });
            return;
          }

          // Drenar stdout/stderr para evitar backpressure
          stream.on('data', () => {});

          // Envolver el comando en el frame de multiplexación de Docker (stdin = tipo 0)
          const payload = Buffer.from(command + '\n', 'utf8');
          const header = Buffer.alloc(8);
          header.writeUInt8(0, 0);      // stream type: 0 = stdin
          header.writeUInt32BE(payload.length, 4); // frame length
          const framed = Buffer.concat([header, payload]);

          stream.write(framed, (writeErr) => {
            if (writeErr) {
              console.error(`❌ Error al escribir comando: ${writeErr.message}`);
            }
            setTimeout(() => {
              stream.end();
              clearTimeout(timeout);
              console.log(`📨 Comando enviado: ${command}`);
              resolve({ success: true, command });
            }, 300);
          });
        }
      );
    });
  } catch (error) {
    console.error(`❌ Error enviando comando: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ─── HOST PATHS (bind-mounted data) ─────────────────────
// Fetch from config to support environment overrides

/** Mapeo entre claves de server.properties y variables de entorno del docker-compose */
const PROP_TO_ENV = {
  'motd': 'MOTD',
  'difficulty': 'DIFFICULTY',
  'gamemode': 'GAMEMODE',
  'pvp': 'PVP',
  'online-mode': 'ONLINE_MODE',
  'max-players': 'MAX_PLAYERS',
  'view-distance': 'VIEW_DISTANCE',
  'simulation-distance': 'SIMULATION_DISTANCE',
  'level-seed': 'LEVEL_SEED',
  'level-name': 'LEVEL_NAME',
  'level-type': 'LEVEL_TYPE',
  'allow-nether': 'ALLOW_NETHER',
  'allow-end': 'ALLOW_END',
  'generate-structures': 'GENERATE_STRUCTURES',
  'server-port': 'SERVER_PORT',
  'enable-query': 'ENABLE_QUERY',
  'spawn-protection': 'SPAWN_PROTECTION',
  'hardcore': 'HARDCORE',
  'white-list': 'WHITE_LIST',
  'allow-flight': 'ALLOW_FLIGHT',
  'force-gamemode': 'FORCE_GAMEMODE',
  'enable-command-block': 'ENABLE_COMMAND_BLOCK',
  'spawn-animals': 'SPAWN_ANIMALS',
  'spawn-monsters': 'SPAWN_MONSTERS',
  'spawn-npcs': 'SPAWN_NPCS',
  'broadcast-console-to-ops': 'BROADCAST_CONSOLE_TO_OPS',
  'broadcast-rcon-to-ops': 'BROADCAST_RCON_TO_OPS',
  'enable-rcon': 'ENABLE_RCON',
  'enforce-secure-profile': 'ENFORCE_SECURE_PROFILE',
  'prevent-proxy-connections': 'PREVENT_PROXY_CONNECTIONS',
};

/** Envía un comando RCON rápido (sin preocuparse por la respuesta) */
async function rconQuick(cmd) {
  const client = new RCON();
  try {
    await client.connect(RCON_HOST, RCON_PORT);
    await client.login(RCON_PASSWORD);
    await client.execute(cmd);
    return true; // Success
  } catch (error) {
    console.error(`⚠️  rconQuick('${cmd}') failed:`, error.message);
    return false; // Failure
  } finally {
    try {
      await client.close();
    } catch (closeErr) {
      // Ignore close errors
    }
  }
}

/** Lista los backups existentes */
export async function listBackups() {
  try {
    await fs.promises.mkdir(config.BACKUP_DIR, { recursive: true });
    const files = await fs.promises.readdir(config.BACKUP_DIR);
    const backups = [];
    for (const f of files) {
      if (!f.endsWith('.tar.gz')) continue;
      const fp = path.join(config.BACKUP_DIR, f);
      const stat = await fs.promises.stat(fp);
      backups.push({
        name: f,
        size: stat.size,
        sizeMB: Math.round(stat.size / 1024 / 1024 * 10) / 10,
        created: stat.birthtime || stat.mtime,
      });
    }
    backups.sort((a, b) => new Date(b.created) - new Date(a.created));
    return { success: true, backups };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** Crea un nuevo backup (serialized to prevent concurrent backups) */
export async function createBackup() {
  // Queue this backup in the serialization chain
  return (backupPromise = backupPromise.then(_createBackupInternal));
}

async function _createBackupInternal() {
  try {
    // Verificar que el mundo existe
    if (!fs.existsSync(config.WORLD_PATH)) {
      return { success: false, error: 'World folder not found on host' };
    }

    // 1. Flush world saves
    const saveAllSuccess = await rconQuick('save-all');
    if (!saveAllSuccess) {
      console.warn('⚠️  save-all failed; proceeding with save-off');
    }
    await new Promise(r => setTimeout(r, 2000)); // dar tiempo a que flush termine
    
    // 2. Pausar auto-guardado (critical for backup consistency)
    const saveOffSuccess = await rconQuick('save-off');
    if (!saveOffSuccess && !config.ALLOW_UNSAFE_BACKUP) {
      return { success: false, error: 'Failed to disable auto-save (set ALLOW_UNSAFE_BACKUP=1 to override)' };
    }

    try {
      // 3. Nombre del backup
      const now = new Date();
      const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const name = `world-backup-${stamp}.tar.gz`;
      const dest = path.join(config.BACKUP_DIR, name);

      // 4. Crear el directorio si no existe
      await fs.promises.mkdir(config.BACKUP_DIR, { recursive: true });

      // 5. Empaquetar la carpeta world con tar
      console.log(`📦 Creando backup: ${name} …`);
      await execAsync(`tar -czf "${dest}" world`, { cwd: path.dirname(config.WORLD_PATH) });

      // 6. Info del archivo creado
      const stat = await fs.promises.stat(dest);
      console.log(`✅ Backup listo: ${name} (${Math.round(stat.size / 1024 / 1024 * 10) / 10} MB)`);

      // 7. Aplicar política de retención (solo backups regulares, los snapshots de seguridad se conservan)
      try {
        const schedule = await getBackupSchedule();
        await applyRetention(schedule.retention);
      } catch (retErr) {
        console.warn('⚠️ Retention check skipped:', retErr.message);
      }

      return {
        success: true,
        backup: {
          name,
          size: stat.size,
          sizeMB: Math.round(stat.size / 1024 / 1024 * 10) / 10,
          created: stat.birthtime || stat.mtime,
        }
      };
    } finally {
      // 7. Reanudar auto-guardado (always, even if tar failed)
      await rconQuick('save-on');
    }
  } catch (err) {
    console.error('❌ Error creando backup:', err.message);
    // Best-effort: try to resume auto-save
    await rconQuick('save-on').catch(() => {});
    return { success: false, error: err.message };
  }
}

/** Elimina un backup */
export async function deleteBackup(name) {
  try {
    // Validate filename format: must be basename only, end with .tar.gz, no traversal
    if (path.basename(name) !== name || !name.endsWith('.tar.gz') || name.includes('..') || name.includes('/') || name.includes('\\')) {
      return { success: false, error: 'Invalid backup name' };
    }

    const fp = path.join(config.BACKUP_DIR, name);
    
    // Check file exists
    if (!fs.existsSync(fp)) {
      return { success: false, error: 'Backup not found' };
    }

    // Security: resolve real path and verify it's within BACKUP_DIR
    const realPath = await fs.promises.realpath(fp);
    const realBackupDir = await fs.promises.realpath(config.BACKUP_DIR);
    if (!realPath.startsWith(realBackupDir + path.sep) && realPath !== realBackupDir) {
      return { success: false, error: 'Path traversal detected' };
    }

    await fs.promises.unlink(fp);
    console.log(`🗑️ Backup eliminado: ${name}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── RESTORE ───────────────────────────────────────────────
// In-memory restore job: POST starts it, GET /restore/status reports progress.
// Large worlds take a while, so the HTTP call returns immediately.
const restoreJob = { running: false, name: '', phase: 'idle', startedAt: null, result: null };

/** Retorna el estado actual del job de restauración */
export function getRestoreStatus() {
  return { ...restoreJob };
}

/** Inicia un restore (fire-and-forget) si no hay otro en curso */
export function startRestoreBackup(name) {
  if (restoreJob.running) {
    return { success: false, error: 'A restore is already in progress' };
  }
  if (path.basename(name) !== name || !name.endsWith('.tar.gz') || name.includes('..') || name.includes('/') || name.includes('\\')) {
    return { success: false, error: 'Invalid backup name' };
  }
  const fp = path.join(config.BACKUP_DIR, name);
  if (!fs.existsSync(fp)) {
    return { success: false, error: 'Backup not found' };
  }

  restoreJob.running = true;
  restoreJob.name = name;
  restoreJob.phase = 'queued';
  restoreJob.startedAt = new Date().toISOString();
  restoreJob.result = null;

  _runRestore(name).catch((err) => {
    console.error('❌ Restore crashed:', err.message);
    restoreJob.phase = 'error';
    restoreJob.running = false;
    restoreJob.result = { success: false, error: err.message };
  });

  return { success: true, message: 'Restore started' };
}

async function _runRestore(name) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const worldDir = path.dirname(config.WORLD_PATH);
  let oldWorldPath = null;
  let snapshotName = null;

  try {
    // 1. Detener el servidor de forma segura
    restoreJob.phase = 'stopping';
    const stop = await stopServer();
    if (!stop.success) throw new Error(stop.error || 'Failed to stop server');

    // Esperar a que el contenedor realmente se detenga (máx. 60s)
    for (let i = 0; i < 30; i++) {
      const s = await getServerStatus();
      if (!s.running) break;
      await new Promise(r => setTimeout(r, 2000));
    }
    const afterStop = await getServerStatus();
    if (afterStop.running) throw new Error('Server did not stop in time');

    // 2. Snapshot de seguridad del mundo actual
    if (fs.existsSync(config.WORLD_PATH)) {
      restoreJob.phase = 'snapshot';
      snapshotName = `pre-restore-${stamp}.tar.gz`;
      await fs.promises.mkdir(config.BACKUP_DIR, { recursive: true });
      const snapshotDest = path.join(config.BACKUP_DIR, snapshotName);
      console.log(`📦 Snapshot de seguridad: ${snapshotName} …`);
      await execAsync(`tar -czf "${snapshotDest}" world`, { cwd: worldDir });
    }

    // 3. Mover el mundo actual a un lado y extraer el backup
    restoreJob.phase = 'extracting';
    oldWorldPath = path.join(worldDir, `world.old-${stamp}`);
    if (fs.existsSync(config.WORLD_PATH)) {
      await fs.promises.rename(config.WORLD_PATH, oldWorldPath);
    }
    const backupPath = path.join(config.BACKUP_DIR, name);
    try {
      await execAsync(`tar -xzf "${backupPath}"`, { cwd: worldDir });
    } catch (err) {
      // Rollback: restaurar el mundo anterior
      await fs.promises.rm(config.WORLD_PATH, { recursive: true, force: true }).catch(() => {});
      if (fs.existsSync(oldWorldPath)) {
        await fs.promises.rename(oldWorldPath, config.WORLD_PATH);
      }
      throw new Error(`Extract failed, world rolled back: ${err.message}`);
    }

    // 4. Encender el servidor de nuevo
    restoreJob.phase = 'starting';
    const start = await startServer();
    if (!start.success) throw new Error(start.error || 'Failed to start server');

    // 5. Limpiar el mundo antiguo (el snapshot ya existe como respaldo)
    restoreJob.phase = 'cleaning';
    if (oldWorldPath && fs.existsSync(oldWorldPath)) {
      await fs.promises.rm(oldWorldPath, { recursive: true, force: true }).catch(() => {});
    }

    restoreJob.phase = 'done';
    restoreJob.result = {
      success: true,
      message: 'World restored and server started',
      snapshot: snapshotName,
    };
    console.log('✅ Restauración completada');
  } catch (err) {
    console.error('❌ Restore failed:', err.message);
    restoreJob.phase = 'error';
    restoreJob.result = { success: false, error: err.message };
    // Best effort: intentar volver a encender el servidor si quedó apagado
    try {
      const s = await getServerStatus();
      if (!s.running) await startServer();
    } catch (restartErr) {
      console.warn('⚠️ No se pudo rearrancar tras fallo de restore:', restartErr.message);
    }
  } finally {
    restoreJob.running = false;
  }
}

// ─── BACKUP SCHEDULE ────────────────────────────────────────
const SCHEDULE_FILE = () => path.join(config.BACKUP_DIR, '.backup-schedule.json');

/** Lee la programación de backups (archivo JSON editado desde el panel) */
export async function getBackupSchedule() {
  const defaults = {
    enabled: config.BACKUP_SCHEDULE_ENABLED,
    intervalHours: config.BACKUP_INTERVAL_HOURS,
    retention: config.BACKUP_RETENTION,
    lastRun: null,
  };
  try {
    const raw = await fs.promises.readFile(SCHEDULE_FILE(), 'utf8');
    const schedule = { ...defaults, ...JSON.parse(raw) };
    schedule.nextRun = schedule.enabled && schedule.lastRun
      ? new Date(new Date(schedule.lastRun).getTime() + schedule.intervalHours * 3600e3).toISOString()
      : null;
    return schedule;
  } catch {
    return { ...defaults, nextRun: null };
  }
}

/** Actualiza la programación y la persiste en el archivo */
export async function setBackupSchedule(updates) {
  try {
    const current = await getBackupSchedule();
    const next = {
      enabled: current.enabled,
      intervalHours: current.intervalHours,
      retention: current.retention,
      lastRun: current.lastRun,
    };

    if (typeof updates.enabled === 'boolean') next.enabled = updates.enabled;
    if (updates.lastRun !== undefined) next.lastRun = updates.lastRun ? new Date(updates.lastRun).toISOString() : null;
    if (updates.intervalHours !== undefined) {
      const h = Number(updates.intervalHours);
      if (!Number.isFinite(h) || h < 1 || h > 8760) return { success: false, error: 'intervalHours must be between 1 and 8760' };
      next.intervalHours = h;
    }
    if (updates.retention !== undefined) {
      const n = Number(updates.retention);
      if (!Number.isInteger(n) || n < 0 || n > 500) return { success: false, error: 'retention must be an integer between 0 and 500 (0 = unlimited)' };
      next.retention = n;
    }

    await fs.promises.mkdir(config.BACKUP_DIR, { recursive: true });
    await fs.promises.writeFile(SCHEDULE_FILE(), JSON.stringify(next, null, 2), 'utf8');
    return { success: true, schedule: await getBackupSchedule() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** Ejecuta un backup si la programación lo requiere (llamado cada minuto) */
export async function runScheduledBackup() {
  try {
    const schedule = await getBackupSchedule();
    if (!schedule.enabled) return null;
    const now = Date.now();
    if (schedule.lastRun && now - new Date(schedule.lastRun).getTime() < schedule.intervalHours * 3600e3) return null;

    console.log('⏰ Ejecutando backup programado…');
    const result = await createBackup();
    if (result.success) {
      await setBackupSchedule({ lastRun: new Date().toISOString() });
      console.log('✅ Backup programado completado');
    } else {
      console.warn('⚠️ Backup programado falló:', result.error);
    }
    return result;
  } catch (err) {
    console.error('❌ Error en backup programado:', err.message);
    return { success: false, error: err.message };
  }
}

/** Elimina los backups regulares más antiguos dejando los `keep` más recientes */
async function applyRetention(keep) {
  if (!keep || keep <= 0) return;
  try {
    const files = await fs.promises.readdir(config.BACKUP_DIR);
    const regular = files
      .filter(f => f.startsWith('world-backup-') && f.endsWith('.tar.gz'))
      .sort()
      .reverse(); // ISO timestamps → lexicographic sort = newest first
    for (const f of regular.slice(keep)) {
      await fs.promises.unlink(path.join(config.BACKUP_DIR, f));
      console.log(`🗑️ Retención eliminó backup antiguo: ${f}`);
    }
  } catch (err) {
    console.warn('⚠️ Aplicación de retención falló:', err.message);
  }
}

// ─── PLAYER MANAGEMENT (via RCON) ───────────────────────────
const PLAYER_NAME_RE = /^[A-Za-z0-9_]{1,16}$/;

/** Ejecuta un comando RCON y devuelve { success, output|error } */
export async function rconCommand(cmd) {
  const client = new RCON();
  try {
    await client.connect(RCON_HOST, RCON_PORT);
    await client.login(RCON_PASSWORD);
    const response = await client.execute(cmd);
    return { success: true, output: response };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

/** Acciones sobre jugadores: kick, ban, unban, op, deop */
export async function playerAction(action, player, reason = '') {
  const builders = {
    kick: (p, r) => `kick ${p} ${r}`.trimEnd(),
    ban: (p, r) => `ban ${p} ${r}`.trimEnd(),
    unban: p => `pardon ${p}`,
    op: p => `op ${p}`,
    deop: p => `deop ${p}`,
  };
  if (!builders[action]) return { success: false, error: `Unknown action: ${action}` };
  if (!PLAYER_NAME_RE.test(player || '')) return { success: false, error: 'Invalid player name' };
  if (reason && /[\r\n]/.test(reason)) return { success: false, error: 'Invalid reason' };

  const result = await rconCommand(builders[action](player, reason || ''));
  if (result.success && /does not exist|not found/i.test(result.output || '')) {
    return { success: false, error: result.output };
  }
  return result;
}

/** Lista la whitelist vía RCON (`whitelist list`) */
export async function listWhitelist() {
  const res = await rconCommand('whitelist list');
  if (!res.success) return res;
  const text = res.output || '';
  // "There are no white-listed players" has no colon; any list of players does.
  const idx = text.indexOf(':');
  if (idx < 0 || /no white-?listed players/i.test(text)) return { success: true, players: [] };
  return { success: true, players: text.slice(idx + 1).split(',').map(n => n.trim()).filter(Boolean) };
}

/** Acciones sobre la whitelist: add, remove, on, off, reload */
export async function whitelistAction(action, player) {
  if (!['add', 'remove', 'on', 'off', 'reload'].includes(action)) {
    return { success: false, error: `Unknown whitelist action: ${action}` };
  }
  if (action === 'add' || action === 'remove') {
    if (!PLAYER_NAME_RE.test(player || '')) return { success: false, error: 'Invalid player name' };
    return rconCommand(`whitelist ${action} ${player}`);
  }
  return rconCommand(`whitelist ${action}`);
}

/** Lee la lista de baneados directamente de banned-players.json (estructurado y fiable) */
async function readVanillaBanList() {
  try {
    const fp = path.join(config.HOST_DATA_DIR, 'banned-players.json');
    const raw = await fs.promises.readFile(fp, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((e) => ({
        name: e.name || '',
        reason: e.reason || '',
        expires: e.expires && e.expires !== 'forever' ? parseVanillaDate(e.expires) : null,
        created: e.created || null,
      }))
      .filter((e) => e.name);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.error('Error reading banned-players.json:', err.message);
    return [];
  }
}

/** Convierte el formato de fecha de Minecraft ("2026-08-26 12:18:49 +0000") a ISO */
function parseVanillaDate(str) {
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  d = new Date(str.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Lista los baneados (banned-players.json) + baneos temporales del panel */
export async function listBans() {
  const bans = await readVanillaBanList();

  // Overlay de baneos temporales gestionados por el panel (fecha de expiración)
  const tempBans = await readTempBans();
  for (const tb of tempBans) {
    const existing = bans.find((b) => b.name === tb.name);
    if (existing) {
      existing.expires = tb.until;
      if (!existing.reason) existing.reason = tb.reason || '';
    } else {
      bans.push({ name: tb.name, reason: tb.reason || '', expires: tb.until, created: null });
    }
  }

  // Permanentes primero, luego por fecha de creación (más reciente arriba)
  bans.sort((a, b) => {
    const an = a.expires ? 1 : 0;
    const bn = b.expires ? 1 : 0;
    if (an !== bn) return an - bn;
    return new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime();
  });
  return { success: true, bans };
}

// ─── TEMP BANS (expiración gestionada por el panel) ─────────
const TEMPBAN_FILE = () => path.join(config.BACKUP_DIR, '.temp-bans.json');

async function readTempBans() {
  try {
    const raw = await fs.promises.readFile(TEMPBAN_FILE(), 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeTempBans(bans) {
  await fs.promises.mkdir(config.BACKUP_DIR, { recursive: true });
  await fs.promises.writeFile(TEMPBAN_FILE(), JSON.stringify(bans, null, 2), 'utf8');
}

/** Banea temporalmente: RCON `ban` + expiración automática por el panel */
export async function tempBanPlayer(player, reason = '', hours) {
  const h = Number(hours);
  if (!Number.isFinite(h) || h < 0.1 || h > 8760) {
    return { success: false, error: 'hours must be between 0.1 and 8760' };
  }
  if (!PLAYER_NAME_RE.test(player || '')) return { success: false, error: 'Invalid player name' };
  if (reason && /[\r\n]/.test(reason)) return { success: false, error: 'Invalid reason' };

  const until = new Date(Date.now() + h * 3600e3).toISOString();
  const cmd = `ban ${player}${reason ? ` ${reason}` : ''}`;
  const res = await rconCommand(cmd);
  if (!res.success) return res;
  // Vanilla rechaza nombres desconocidos en servidores online-mode
  if (/does not exist|not found/i.test(res.output || '')) {
    return { success: false, error: res.output };
  }

  const bans = await readTempBans();
  const existing = bans.find((b) => b.name === player);
  if (existing) {
    existing.until = until;
    if (reason) existing.reason = reason;
  } else {
    bans.push({ name: player, reason: reason || '', until });
  }
  await writeTempBans(bans);
  return { success: true, output: res.output, expires: until };
}

/** Desbanea y limpia cualquier baneo temporal pendiente del mismo jugador */
export async function unbanPlayer(player) {
  const res = await playerAction('unban', player);
  if (res.success) {
    const bans = await readTempBans();
    const next = bans.filter((b) => b.name !== player);
    if (next.length !== bans.length) await writeTempBans(next);
  }
  return res;
}

/** Pardona los baneos temporales vencidos (llamado por el timer del minuto) */
export async function processExpiredTempBans() {
  const bans = await readTempBans();
  if (bans.length === 0) return null;
  const now = Date.now();
  const expired = bans.filter((b) => new Date(b.until).getTime() <= now);
  if (expired.length === 0) return null;

  for (const b of expired) {
    const res = await rconCommand(`pardon ${b.name}`);
    if (res.success) {
      console.log(`⏳ Baneo temporal expirado, desbaneado: ${b.name}`);
    } else {
      console.warn(`⚠️ No se pudo desbanear a ${b.name}: ${res.error}`);
    }
  }
  const remaining = bans.filter((b) => !expired.some((e) => e.name === b.name));
  await writeTempBans(remaining);
  return { expired: expired.map((e) => e.name) };
}

// ─── SERVER ICON (server-icon.png, 64x64) ─────────────────

/** Valida la firma PNG y devuelve las dimensiones desde el chunk IHDR */
function parsePngSize(buf) {
  if (!buf || buf.length < 24) return null;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

/** Lee el icono actual del servidor como data URL (o null si no existe) */
export async function readServerIcon() {
  try {
    const fp = path.join(config.HOST_DATA_DIR, 'server-icon.png');
    const buf = await fs.promises.readFile(fp);
    if (buf.length > 2 * 1024 * 1024) return { success: true, icon: null };
    return { success: true, icon: `data:image/png;base64,${buf.toString('base64')}` };
  } catch {
    return { success: true, icon: null };
  }
}

/** Escribe un nuevo server-icon.png (debe ser PNG de exactamente 64x64) */
export async function writeServerIcon(dataUrl) {
  try {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
      return { success: false, error: 'Expected a base64 PNG data URL' };
    }
    const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    if (buf.length > 2 * 1024 * 1024) {
      return { success: false, error: 'Icon file too large (max 2 MB)' };
    }
    const size = parsePngSize(buf);
    if (!size) return { success: false, error: 'Invalid PNG data' };
    if (size.width !== 64 || size.height !== 64) {
      return { success: false, error: `Icon must be 64x64 (got ${size.width}x${size.height})` };
    }
    await fs.promises.writeFile(path.join(config.HOST_DATA_DIR, 'server-icon.png'), buf);
    console.log('🖼️ server-icon.png guardado');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}