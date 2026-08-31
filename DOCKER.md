# Run MC Control Panel with Docker

This Compose project runs the panel separately from your existing Minecraft Compose project. The backend controls the Minecraft container through the Docker socket and a shared external network.

> This document assumes you have read the [main README](README.md).

## Prerequisites

- Docker Engine with Compose v2
- A Minecraft stack already running with RCON enabled (`enable-rcon=true` + `rcon.password`)
- A host directory for the Minecraft stack containing `minecraft_data/` (with `server.properties`), `backups/`, and `docker-compose.yml`
- An external Docker network shared by both stacks:

```bash
docker network create minecraft_net
```

Attach the Minecraft stack to it by adding to its Compose file:

```yaml
networks:
  minecraft_net:
    external: true
```

and to the Minecraft service:

```yaml
    networks:
      - minecraft_net
```

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Required values:

- `MINECRAFT_ROOT` — absolute host path of the Minecraft stack directory
- `MINECRAFT_NETWORK` — the external network name from above
- `RCON_PASSWORD` — must match the Minecraft server's `rcon.password`
- `API_TOKEN` — generate a strong token: `openssl rand -hex 32`

Recommended:

- `DOCKER_SOCKET_GID` — set to `stat -c '%g' /var/run/docker.sock` so the non-root backend user can access the socket
- `CORS_ORIGIN` — keep it matching the panel origin

> The frontend receives `API_TOKEN` as a build argument because the browser sends it with each request. Treat the built frontend image as containing that token and rebuild it whenever the token changes.

## Build and start

```bash
docker compose build
docker compose up -d
docker compose ps
```

Both services should report `healthy`. Open `http://localhost:8081` (or your `PANEL_PORT`).

Verify the backend through the frontend proxy:

```bash
curl http://localhost:8081/api/health
# {"ok":true,"message":"Server healthy, Docker reachable"}
```

## Stop / update / remove

Stop the panel without touching Minecraft:

```bash
docker compose down
```

Update to the latest version:

```bash
git pull
docker compose up -d --build
```

Remove the panel completely (containers, networks, images):

```bash
docker compose down --rmi all
```

## How the two stacks connect

- The backend mounts `/var/run/docker.sock` to inspect, start, stop, and stream logs from the Minecraft container.
- The backend mounts `MINECRAFT_ROOT` at `/minecraft` to read/update `server.properties`, sync the Minecraft Compose file, and store backups. World data and backups are never copied into either image.
- The backend reaches Minecraft by container name over the shared network:
  - `minecraft-server:25575` — RCON (commands, saves, player actions)
  - `minecraft-server:25565` — status/query probes
- The backend itself is never published to the host; only the Nginx frontend port is exposed.

## Security notes

- **Docker socket = host control.** The backend mounts `/var/run/docker.sock`, so the panel can manage containers on the host. Only expose the panel to trusted users, keep the backend unpublished, and never mount the socket into anything untrusted.
- The backend container runs as a non-root user, drops all Linux capabilities, and sets `no-new-privileges`. It only gets socket access through the `DOCKER_SOCKET_GID` group.
- The API and WebSocket require `Authorization: Bearer <API_TOKEN>`; failed attempts are rate-limited per IP.
- Keep `.env` private (it is git-ignored) and use a strong random `API_TOKEN`.
- Do not expose the panel to the internet over plain HTTP — put a TLS reverse proxy in front of it (examples in the [README](README.md#security)).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `backend is unhealthy` | Verify `DOCKER_SOCKET_GID` matches the socket group (`stat -c '%g' /var/run/docker.sock`) and that the Minecraft container exists. |
| RCON commands fail | Confirm `RCON_PASSWORD`, `RCON_HOST=minecraft-server`, and that both Compose projects use the same external network. |
| Frontend cannot reach the API | Check `docker compose logs backend frontend` and confirm the backend healthcheck passes. |
| Port `8081` is busy | Set another value for `PANEL_PORT` in `.env`, then `docker compose up -d --force-recreate`. |
| Panel shows `401` after changing `API_TOKEN` | Rebuild the frontend image: `docker compose up -d --build`. |
