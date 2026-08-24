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
    // Network/HTTP errors pass through
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
   * Download a backup file
   */
  downloadBackup(name) {
    return `${API_URL}/api/server/backups/${name}/download${API_TOKEN ? `?token=${API_TOKEN}` : ''}`;
  },

  /**
   * Health check
   */
  async health() {
    const res = await apiClient.get('/api/health');
    return res.data;
  },
};
