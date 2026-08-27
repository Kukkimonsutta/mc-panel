import axios from 'axios';
import { io } from 'socket.io-client';

/**
 * API configuration and client setup for the MC Panel frontend.
 * Supports both relative URLs (via Vite dev proxy) and explicit API_URL.
 */

// Get API URL from environment or default to relative URL (for Vite proxy)
const API_URL = import.meta.env.VITE_API_URL || '';

// Get API token from environment (optional, only if backend requires auth)
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';

/**
 * Axios instance with auth header and response interceptor
 */
const apiClient = axios.create({
  baseURL: API_URL || undefined, // undefined means use relative URLs
  timeout: 10000,
});

// Add auth token to all requests if configured
if (API_TOKEN) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${API_TOKEN}`;
}

// Response interceptor: treat {success: false} as error
apiClient.interceptors.response.use(
  (response) => {
    // Check for backend error format {success: false, error: ...}
    if (response.data && response.data.success === false) {
      const error = new Error(response.data.error || 'Request failed');
      error.response = response;
      throw error;
    }
    return response;
  },
  (error) => {
    // Surface backend error messages ({ success: false, error }) instead of generic HTTP text.
    // Skip Blob responses (e.g. failed file downloads) — those are parsed by callers.
    const data = error.response?.data;
    if (data && typeof data === 'object' && !(data instanceof Blob) && (data.error || data.message)) {
      error.message = data.error || data.message;
    }
    return Promise.reject(error);
  }
);

/**
 * Get Socket.IO URL (may differ from API_URL if serving separate domains)
 */
export function getSocketURL() {
  if (API_URL) {
    return API_URL;
  }
  // For relative URLs, return the current origin
  return window.location.origin;
}

/**
 * Initialize Socket.IO connection with optional auth
 */
export function createSocketConnection() {
  const url = getSocketURL();
  const options = {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  };

  if (API_TOKEN) {
    options.auth = { token: API_TOKEN };
  }

  return io(url, options);
}

/**
 * Export the API client for direct use
 */
export default apiClient;

/**
 * Convenience wrappers for common operations
 */
export const api = {
  /**
   * Get server status (online/offline, player count, version)
   */
  async getStatus() {
    const res = await apiClient.get('/api/server/status');
    return res.data;
  },

  /**
   * Get extended server query data (MOTD, plugins, map, players list)
   */
  async getQuery() {
    const res = await apiClient.get('/api/server/query');
    return res.data;
  },

  /**
   * Get resource stats (CPU, RAM)
   */
  async getStats() {
    const res = await apiClient.get('/api/server/stats');
    return res.data;
  },

  /**
   * Get the latest N container log lines (for history loading)
   */
  async getLogs(lines = 1000) {
    const res = await apiClient.get('/api/server/logs', { params: { lines } });
    return res.data;
  },

  /**
   * Start server
   */
  async startServer() {
    const res = await apiClient.post('/api/server/start');
    return res.data;
  },

  /**
   * Stop server
   */
  async stopServer() {
    const res = await apiClient.post('/api/server/stop');
    return res.data;
  },

  /**
   * Send console command
   */
  async sendCommand(command) {
    const res = await apiClient.post('/api/server/command', { command });
    return res.data;
  },

  /**
   * Get server.properties as object
   */
  async getProperties() {
    const res = await apiClient.get('/api/server/properties');
    return res.data;
  },

  /**
   * Update server.properties
   */
  async updateProperties(updates) {
    const res = await apiClient.post('/api/server/properties', updates);
    return res.data;
  },

  /**
   * List all backups
   */
  async listBackups() {
    const res = await apiClient.get('/api/server/backups');
    return res.data;
  },

  /**
   * Create a new backup
   */
  async createBackup() {
    const res = await apiClient.post('/api/server/backups');
    return res.data;
  },

  /**
   * Delete a backup
   */
  async deleteBackup(name) {
    const res = await apiClient.delete(`/api/server/backups/${name}`);
    return res.data;
  },

  /**
   * Download a backup file via authenticated fetch (Bearer header), then
   * trigger a browser download. Never exposes the token in URLs.
   */
  async downloadBackup(name) {
    let res;
    try {
      res = await apiClient.get(`/api/server/backups/${name}/download`, {
        responseType: 'blob',
        timeout: 0, // Large worlds can take a while to download
      });
    } catch (e) {
      // Extract backend error message from the blob body if present
      if (e.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await e.response.data.text());
          throw new Error(parsed.error || 'Download failed');
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) throw new Error('Download failed');
          throw parseErr;
        }
      }
      throw new Error(e.message || 'Download failed');
    }

    // Prefer the filename sent by the server (Content-Disposition)
    let filename = name;
    const disposition = res.headers?.['content-disposition'] || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    if (match) filename = match[1];

    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { success: true, name: filename };
  },

  /**
   * Start restoring a backup (runs server-side as a background job)
   */
  async restoreBackup(name) {
    const res = await apiClient.post(`/api/server/backups/${name}/restore`);
    return res.data;
  },

  /**
   * Get the current restore job status
   */
  async getRestoreStatus() {
    const res = await apiClient.get('/api/server/restore/status');
    return res.data;
  },

  /**
   * Get the backup schedule
   */
  async getBackupSchedule() {
    const res = await apiClient.get('/api/server/backups/schedule');
    return res.data;
  },

  /**
   * Update the backup schedule
   */
  async setBackupSchedule(schedule) {
    const res = await apiClient.post('/api/server/backups/schedule', schedule);
    return res.data;
  },

  /**
   * Player management action (kick, ban, unban, op, deop) via RCON
   */
  async playerAction({ action, player, reason }) {
    const res = await apiClient.post('/api/server/players/action', { action, player, reason });
    return res.data;
  },

  /**
   * Temporary ban — the player is unbanned automatically after N hours
   */
  async tempBan({ player, reason, hours }) {
    const res = await apiClient.post('/api/server/players/tempban', { player, reason, hours });
    return res.data;
  },

  /**
   * List whitelisted players
   */
  async getWhitelist() {
    const res = await apiClient.get('/api/server/players/whitelist');
    return res.data;
  },

  /**
   * Whitelist action (add, remove, on, off, reload)
   */
  async whitelistAction({ action, player }) {
    const res = await apiClient.post('/api/server/players/whitelist', { action, player });
    return res.data;
  },

  /**
   * List banned players
   */
  async getBans() {
    const res = await apiClient.get('/api/server/players/bans');
    return res.data;
  },

  /**
   * Get the current server icon (data URL, or null if none)
   */
  async getIcon() {
    const res = await apiClient.get('/api/server/icon');
    return res.data;
  },

  /**
   * Save a new server icon (64x64 PNG data URL)
   */
  async saveIcon(data) {
    const res = await apiClient.post('/api/server/icon', { data });
    return res.data;
  },

  /**
   * Health check
   */
  async health() {
    const res = await apiClient.get('/api/health');
    return res.data;
  },
};
