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