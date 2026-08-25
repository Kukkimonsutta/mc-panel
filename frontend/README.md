# MC Panel — Frontend

Vue 3 + Vite client for the MC Server Control Panel. See the [root README](../README.md) for the full project documentation.

## Development

```bash
npm install
npm run dev
```

Vite runs on `http://localhost:5173` and proxies `/api` and `/socket.io` to the backend on `http://localhost:3005`.

From the repository root, `npm run dev` starts the backend and frontend together.

## Build

```bash
npm run build
```

Outputs to `dist/`. In production, Nginx serves `dist/` and proxies API/WebSocket traffic to the backend (`nginx.conf`).

## Environment

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend URL; leave unset for same-origin/proxy usage |
| `VITE_API_TOKEN` | Sent as `Authorization: Bearer <token>` when the backend requires auth |

## Components

- `App.vue` — dashboard layout, polling, WebSocket logs
- `PlayerList.vue` — online players and server metadata
- `FastCommands.vue` — quick commands (op, tp, kick, ban, gamemode, whitelist, say)
- `SettingsPanel.vue` — properties editor, MOTD, backups, restart
- `BackupManager.vue` — create, list, and delete backups
- `MotdEditor.vue` — `§`-code MOTD editor with live preview

## License

MIT
