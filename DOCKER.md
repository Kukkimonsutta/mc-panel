# Run MC Panel with Docker

This compose project runs the panel separately from the existing Minecraft compose project. The backend controls the existing `minecraft-server` container through the Docker socket and the external `stark_net` network.

## Prerequisites

- Docker Engine with Compose v2
- The Minecraft stack already running
- The external Docker network `stark_net`
- Host directory containing `minecraft_data/`, `backups/`, and `docker-compose.yml`
- The panel user allowed to access the Docker socket

Create the network once if it does not exist:

```bash
docker network create stark_net
```

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Set at least:

- `MINECRAFT_ROOT` to the host Minecraft directory
- `RCON_PASSWORD` to the Minecraft RCON password
- `API_TOKEN` to a strong panel token
- `DOCKER_SOCKET_GID` to `stat -c '%g' /var/run/docker.sock`

The frontend receives `API_TOKEN` as a build argument because the current frontend client sends it from the browser. Treat the built frontend image as containing that token and rebuild it whenever the token changes.

## Start

```bash
docker compose build
docker compose up -d
docker compose ps
```

Open `http://localhost:8080` unless `PANEL_PORT` was changed.

Check the backend through the frontend proxy:

```bash
curl http://localhost:8080/api/health
```

Stop the panel without affecting Minecraft:

```bash
docker compose down
```

## Security notes

The backend mounts `/var/run/docker.sock`, which grants control over the Docker host. Keep the backend unpublished and expose only the frontend. Use a strong `API_TOKEN`, keep `.env` private, and prefer a protected network or TLS reverse proxy when exposing the panel beyond localhost.

The backend also mounts the Minecraft directory because it reads and updates `server.properties`, rewrites the existing Minecraft compose file, and stores backups. World data and backups are not copied into either image.

## Troubleshooting

- `backend is unhealthy`: verify `DOCKER_SOCKET_GID` matches the socket group and that `minecraft-server` exists.
- RCON commands fail: confirm `RCON_PASSWORD`, `RCON_HOST=minecraft-server`, and that both compose projects use `stark_net`.
- Frontend cannot reach the API: inspect `docker compose logs backend frontend` and confirm the backend healthcheck passes.
- Port `8080` is busy: set another value such as `PANEL_PORT=18080` in `.env`.
