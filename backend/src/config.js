/**
 * Centralized configuration for the MC Panel backend.
 * All values can be overridden via environment variables.
 * Defaults are set to the original hardcoded values for compatibility.
 */

import 'dotenv/config.js';

export const config = {
  // Server ports and networking
  PORT: parseInt(process.env.PORT || '3005', 10),
  MC_STATUS_PORT: parseInt(process.env.MC_STATUS_PORT || '25565', 10),
  MC_QUERY_PORT: parseInt(process.env.MC_QUERY_PORT || '25565', 10),

  // Docker configuration
  DOCKER_SOCKET: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
  TARGET_CONTAINER_NAME: process.env.TARGET_CONTAINER_NAME || 'minecraft-server',

  // RCON configuration
  RCON_HOST: process.env.RCON_HOST || '127.0.0.1',
  RCON_PORT: parseInt(process.env.RCON_PORT || '25575', 10),
  RCON_PASSWORD: process.env.RCON_PASSWORD || '1234@4321', // Default kept for compatibility; warn in index.js

  // Host paths (directories on the Docker host machine)
  HOST_DATA_DIR: process.env.HOST_DATA_DIR || '/home/kukkimonsuta/docker/minecraft/minecraft_data',
  HOST_COMPOSE_FILE: process.env.HOST_COMPOSE_FILE || '/home/kukkimonsuta/docker/minecraft/docker-compose.yml',
  BACKUP_DIR: process.env.BACKUP_DIR || '/home/kukkimonsuta/docker/minecraft/backups',

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

  // Feature flags
  ENABLE_BACKUP_DOWNLOAD: process.env.ENABLE_BACKUP_DOWNLOAD !== '0', // Enabled by default
};

/**
 * Log configuration warnings at startup
 */
export function logConfigWarnings() {
  const warnings = [];

  if (config.RCON_PASSWORD === '1234@4321') {
    warnings.push('⚠️  RCON using default password "1234@4321" — set RCON_PASSWORD env var to change');
  }

  if (config.CORS_ORIGIN === '*') {
    warnings.push('⚠️  CORS set to "*" — restrict via CORS_ORIGIN env var in production');
  }

  if (!config.API_TOKEN) {
    warnings.push('⚠️  API_TOKEN not set — API is open to unauthenticated requests. Set API_TOKEN env var to require authentication.');
  }

  if (warnings.length > 0) {
    console.warn('Configuration warnings:');
    warnings.forEach(w => console.warn(`  ${w}`));
  }
}

export default config;
