/**
 * Centralized configuration for the MC Panel backend.
 * All values can be overridden via environment variables.
 * Defaults are set to the original hardcoded values for compatibility.
 */

import 'dotenv/config.js';

export const config = {
  // Server ports and networking
  PORT: parseInt(process.env.PORT || '3005', 10),
  MC_HOST: process.env.MC_HOST || '127.0.0.1',
  MC_STATUS_PORT: parseInt(process.env.MC_STATUS_PORT || '25565', 10),
  MC_QUERY_PORT: parseInt(process.env.MC_QUERY_PORT || '25565', 10),

  // Docker configuration
  DOCKER_SOCKET: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
  TARGET_CONTAINER_NAME: process.env.TARGET_CONTAINER_NAME || 'minecraft-server',

  // RCON configuration
  RCON_HOST: process.env.RCON_HOST || '127.0.0.1',
  RCON_PORT: parseInt(process.env.RCON_PORT || '25575', 10),
  RCON_PASSWORD: process.env.RCON_PASSWORD || '', // Empty = RCON features disabled

  // Host paths (directories on the Docker host machine).
  // Defaults match the bind mounts defined in docker-compose.yml.
  HOST_DATA_DIR: process.env.HOST_DATA_DIR || '/minecraft/minecraft_data',
  HOST_COMPOSE_FILE: process.env.HOST_COMPOSE_FILE || '/minecraft/docker-compose.yml',
  BACKUP_DIR: process.env.BACKUP_DIR || '/minecraft/backups',

  // Derived path (read-only after config load)
  get WORLD_PATH() {
    return `${this.HOST_DATA_DIR}/world`;
  },
  get HOST_PROPS_FILE() {
    return `${this.HOST_DATA_DIR}/server.properties`;
  },

  // API authentication (optional)
  API_TOKEN: process.env.API_TOKEN || undefined, // If set, auth is required

  // CORS configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*', // Dev-friendly default; restrict in production

  // Backup safety
  ALLOW_UNSAFE_BACKUP: process.env.ALLOW_UNSAFE_BACKUP === '1', // If set, backup proceeds even if save-off fails

  // Scheduled backups (initial defaults; adjustable from the panel UI, persisted in BACKUP_DIR)
  BACKUP_SCHEDULE_ENABLED: process.env.BACKUP_SCHEDULE_ENABLED === '1',
  BACKUP_INTERVAL_HOURS: parseFloat(process.env.BACKUP_INTERVAL_HOURS || '24') || 24,
  BACKUP_RETENTION: parseInt(process.env.BACKUP_RETENTION || '10', 10) || 0, // 0 = unlimited

  // Feature flags
  ENABLE_BACKUP_DOWNLOAD: process.env.ENABLE_BACKUP_DOWNLOAD !== '0', // Enabled by default
};

/**
 * Log configuration warnings at startup
 */
export function logConfigWarnings() {
  const warnings = [];

  if (!config.RCON_PASSWORD) {
    warnings.push('⚠️  RCON_PASSWORD not set — console commands, player actions, and backups will not work. Set RCON_PASSWORD to the Minecraft server\'s RCON password.');
  }

  if (config.CORS_ORIGIN === '*') {
    warnings.push('⚠️  CORS set to "*" — restrict via CORS_ORIGIN env var in production');
  }

  if (!config.API_TOKEN) {
    warnings.push('⚠️  API_TOKEN not set — API is open to unauthenticated requests. Set API_TOKEN env var to require authentication.');
  } else if (String(config.API_TOKEN).length < 16) {
    warnings.push('⚠️  API_TOKEN is shorter than 16 characters — use a strong random token (e.g. `openssl rand -hex 32`)');
  }

  if (warnings.length > 0) {
    console.warn('Configuration warnings:');
    warnings.forEach(w => console.warn(`  ${w}`));
  }
}

export default config;
