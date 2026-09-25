# Docker

Runs the app as a single container, with its data in a folder on the host
and the LLM (Ollama by default, or Claude) outside the container.

## Run it

Requires Docker Desktop running.

```bash
docker compose up -d --build   # build the image and start it
open http://localhost:3000
docker compose logs -f         # follow the logs
docker compose down            # stop it
```

After pulling new code, run `docker compose up -d --build` again. The
container restarts with Docker Desktop (`restart: unless-stopped`).

`npm run dev` also uses port 3000. Stop it first, or set another port with
`APP_PORT` (below).

## Settings

Put them in a `.env` file next to `docker-compose.yml` (it's git-ignored).
Every setting has a default, so the app runs without one.

| Variable | Default | What it does |
|---|---|---|
| `APP_PORT` | `3000` | Port on the Mac |
| `DATA_DIR` | `./storage` | Data folder on the Mac, mounted at `/app/storage` |
| `LLM_PROVIDER` | `ollama` | `ollama` or `anthropic` |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Ollama running on the Mac |
| `OLLAMA_MODEL` | `qwen2.5:latest` | Ollama model for voice and analysis |
| `ANTHROPIC_API_KEY` | — | Needed with `LLM_PROVIDER=anthropic` |

Example `.env` to use Claude instead of Ollama:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

Then `docker compose up -d` (no rebuild needed: these are read at runtime).

## Data

- **Where:** everything the app saves (scenarios, checkpoints, view state)
  is in `DATA_DIR`, by default the project's own `storage/` folder, the same
  one `npm run dev` uses. An empty folder starts with the sample data.
- **Both at once:** the Docker app and `npm run dev` can share the folder;
  saves are checked against the file's revision (`docs/persistence.md`), so
  neither overwrites the other's changes. To keep them apart, point
  `DATA_DIR` at another folder.
- **Backup:** copy the folder, e.g.
  `cp -R storage ~/Backups/roadmap-$(date +%F)`.

## Moving to another Mac

1. Install Docker Desktop (and Ollama with the same model, if you use it:
   `ollama pull qwen2.5`).
2. Copy the project (or `git clone` it) and the data folder. With the
   default `DATA_DIR`, that's the `storage/` folder inside the project,
   which git doesn't track, so copy it by hand.
3. Copy `.env` if you have one.
4. `docker compose up -d --build`.

The image is built for the Mac's CPU (`arm64` on Apple silicon), so
building it there is simplest. To move the built image instead:
`docker save roadmap-app | gzip > roadmap-app.tar.gz` and on the other Mac
`docker load < roadmap-app.tar.gz`, then `docker compose up -d`.

## Good to know

- **Voice needs `localhost` or HTTPS.** Browsers only allow the microphone
  on a secure origin. `http://localhost:3000` on the same Mac works; from
  another machine over plain `http://` it doesn't. Putting a proxy with a
  certificate in front (e.g. Caddy) fixes that.
- **No login.** Anyone who can reach the port can view and edit the
  roadmap. Fine on your own Mac or a trusted network; add authentication
  (e.g. basic auth in a proxy) before exposing it further.
- **One container.** Data lives in files on one disk, so don't run replicas.

## Files

| File | Role |
|---|---|
| `Dockerfile` | Multi-stage build: `npm ci`, `next build` (`output: "standalone"` in `next.config.ts`), then a small runtime with the standalone server, `.next/static` and `public`, running as a non-root user |
| `.dockerignore` | Keeps `node_modules`, `.next`, `storage`, `.env` and git out of the build context |
| `docker-compose.yml` | The service: port, data folder, LLM settings |
