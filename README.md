# MC Control Panel — Frontend

A Vue 3 + Vite control panel for managing a Minecraft server running in Docker.

## Features

- **Real-time server status** — online/offline state, CPU/RAM gauges, engine version
- **Live console** — tail of Docker logs with filtering and command history (`↑/↓` keys)
- **Player management** — online player list with quick commands (op/deop/tp/kick/ban/gamemode)
- **Fast commands** — one-click actions for common server tasks
- **MOTD editor** — colorized Minecraft `§`-code editor with live preview
- **Settings** — edit `server.properties` and restart server
- **Backups** — create/list/delete world backups with integrity checks
- **WebSocket logs** — live streaming of Minecraft server console

## Setup

### Prerequisites
- Node.js ≥ 18
- Running mc-panel backend on `http://localhost:3005` (or configure `VITE_API_URL`)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The dev server runs on `http://localhost:5173` (default Vite port). API requests to `/api/*` are proxied to `http://localhost:3005` via Vite's dev proxy.

**Environment variables** (in `.env.local`):
- `VITE_API_URL` — Backend URL (defaults to relative `/api` when unset, requires Vite proxy)
- `VITE_API_TOKEN` — API token if backend requires authentication

### Build

```bash
npm run build
```

Outputs to `dist/`. The backend does **not** automatically serve the frontend; deploy `dist/` separately or configure reverse-proxy routing.

### Preview

```bash
npm run preview
```

Runs a local preview of the production build.

## Architecture

- **`src/main.js`** — Vue app entry point
- **`src/App.vue`** — Main layout: header, dashboard/settings view switcher, server status, console
- **`src/components/`** — Reusable components:
  - `PlayerList.vue` — Shows online players and server metadata
  - `FastCommands.vue` — Quick-command buttons (op, tp, kick, etc.)
  - `SettingsPanel.vue` — Edit server properties, restart, backups
  - `BackupManager.vue` — Create, list, delete backups
  - `MotdEditor.vue` — MOTD colorizer with `§`-code support

## API

Expects a backend compatible with mc-panel-backend (see `../backend/README.md`).

### Key endpoints (all require `Authorization: Bearer <token>` if `API_TOKEN` is set)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Health check (no auth) |
| `/api/server/status` | GET | Server running state, player count |
| `/api/server/query` | GET | Extended info (version, software, players list, MOTD) |
| `/api/server/stats` | GET | CPU/RAM usage |
| `/api/server/start` | POST | Start container |
| `/api/server/stop` | POST | Stop container |
| `/api/server/command` | POST | Send console command |
| `/api/server/properties` | GET/POST | Read/write `server.properties` |
| `/api/server/backups` | GET/POST/DELETE | List/create/delete backups |

## Known Limitations

- **Backend serves frontend?** No — Vite app is dev-server only; production requires a separate HTTP server or reverse-proxy.
- **Restore from backup?** Not implemented; backups are created and downloaded but cannot be auto-restored.
- **Live property editing** — Changes may be lost if the server restarts while running (Minecraft rewrites the file on shutdown).

## Troubleshooting

**Build fails with "Failed to resolve import"**
- Ensure backend dependencies are installed. If running `npm install` only in `frontend/`, it may fail if `axios` or `socket.io-client` aren't in `package.json`.

**API calls fail with 401**
- Backend requires `API_TOKEN`. Set `VITE_API_TOKEN` environment variable to match backend's `API_TOKEN`.

**Connection refused on `localhost:3005`**
- Backend is not running. Start with `npm run dev` or `npm start` in the `backend/` directory.

**WebSocket connection fails**
- Check `VITE_API_URL` environment variable and ensure `/socket.io` proxy is configured.

## License

MIT
