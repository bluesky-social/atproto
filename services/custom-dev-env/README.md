# Custom Dev Environment (PDS + PLC)

Single Docker image that runs **PDS** and **PLC** in one process. No Postgres or Redis (SQLite + in-memory PLC).

Entry point: `index.js` → `packages/dev-env/dist/custom/custom/run-pds-plc.js`.

## Local usage

From repo root:

```bash
docker compose -f services/custom-dev-env/docker-compose.yml up --build
docker compose -f services/custom-dev-env/docker-compose.yml up -d --build
docker compose -f services/custom-dev-env/docker-compose.yml down
```

From `services/custom-dev-env/` you can run `docker compose up --build` directly.

## Environment

Place a `.env` file **next to** `docker-compose.yml` (optional). Docker Compose reads it for variable substitution. See `.env.example`.

| Variable                          | Default                       | Purpose                                                                               |
| --------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| `PDS_HOST_PORT`                   | `3000`                        | Host → container PDS port                                                             |
| `PLC_HOST_PORT`                   | `3001`                        | Host → container PLC port                                                             |
| `PDS_PORT`                        | `3000`                        | PDS listen port **inside** the container                                              |
| `PLC_PORT`                        | `3001`                        | PLC listen port **inside** the container                                              |
| `PDS_HOSTNAME`                    | `localhost`                   | PDS public hostname (no scheme); used for `did:web` and `https://` when not localhost |
| `PDS_DID_PLC_URL`                 | `http://127.0.0.1:<PLC_PORT>` | URL the PDS uses to reach PLC (keep default in this image)                            |
| `PDS_PUBLIC_URL`                  | (derived)                     | Override client-facing PDS URL in logs / docs                                         |
| `PLC_PUBLIC_URL` / `PLC_HOSTNAME` | (derived)                     | Optional overrides for PLC URL in logs                                                |

## Deploy a pre-built image (GHCR)

On push to the repo **default branch**, `.github/workflows/build-and-push-custom-dev-ghcr.yaml` pushes:

- `ghcr.io/<owner>/<repo>:pds-plc-dev-latest`
- `ghcr.io/<owner>/<repo>:pds-plc-dev:<full-git-sha>`

You can also run the workflow manually (**Actions → build-and-push-custom-dev-ghcr → Run workflow**).

Pull and run (set `PDS_HOSTNAME` to the hostname clients use behind your TLS terminator):

```bash
docker pull ghcr.io/OWNER/REPO:pds-plc-dev-latest
docker run -p 3000:3000 -p 3001:3001 \
  -e PDS_HOSTNAME=pds.example.com \
  ghcr.io/OWNER/REPO:pds-plc-dev-latest
```

## Endpoints (defaults)

- **PDS**: http://localhost:3000
- **PLC**: http://localhost:3001
