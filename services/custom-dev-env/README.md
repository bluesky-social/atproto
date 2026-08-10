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

| Variable                          | Default                               | Purpose                                                                                                           |
| --------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `PDS_HOST_PORT`                   | `3000`                                | Host → container PDS port                                                                                         |
| `PLC_HOST_PORT`                   | `3001`                                | Host → container PLC port                                                                                         |
| `PDS_PORT`                        | `3000`                                | PDS listen port **inside** the container                                                                          |
| `PLC_PORT`                        | `3001`                                | PLC listen port **inside** the container                                                                          |
| `PDS_HOSTNAME`                    | `localhost`                           | PDS public hostname (no scheme); used for `did:web` and `https://` when not localhost                             |
| `PDS_DID_PLC_URL`                 | `http://127.0.0.1:<PLC_PORT>`         | URL the PDS uses to reach PLC (keep default in this image)                                                        |
| `PDS_PUBLIC_URL`                  | (derived)                             | Override client-facing PDS URL in logs / docs                                                                     |
| `PLC_PUBLIC_URL` / `PLC_HOSTNAME` | (derived)                             | Optional overrides for PLC URL in logs                                                                            |
| `APPVIEW_ENABLED`                 | (off)                                 | Set `true` to start bundled Sokaa AppView (requires `DB_POSTGRES_URL`)                                            |
| `DB_POSTGRES_URL`                 | —                                     | Postgres URL for AppView indexing                                                                                 |
| `DB_POSTGRES_SCHEMA`              | `pds_plc`                             | Base name; AppView tables use schema `sokaa_<name>`                                                               |
| `PLC_DB_URL`                      | —                                     | Postgres URL for PLC (recommended when sharing Postgres with AppView)                                             |
| `SOKAA_APPVIEW_CDN_URL`           | (internal `http://127.0.0.1:…/cdn`)   | Media gateway origin, without `/v1/media`; trailing slashes are removed. Explicit HTTPS is required in production |
| `SOKAA_APPVIEW_PUBLIC_URL`        | (internal listen URL)                 | Optional client-facing AppView base URL                                                                           |
| `SOKAA_APPVIEW_PORT`              | (ephemeral)                           | Pin AppView listen port inside the container (optional; PDS proxies `/_sokaa/*` on the PDS port)                  |
| `SOKAA_APPVIEW_ADMIN_PASSWORD`    | (`PDS_ADMIN_PASSWORD` / `admin-pass`) | AppView admin Basic auth for `/_sokaa/video/*`                                                                    |

The production media gateway serves private R2 objects at
`https://<gateway>/v1/media/:did/:cid`. Do not put R2 credentials or a public
bucket URL in AppView configuration.

## Deploy a pre-built image (GHCR)

On push to the repo **default branch**, `.github/workflows/build-and-push-custom-dev-ghcr.yaml` pushes:

- `ghcr.io/<owner>/<repo>:pds-plc-dev-latest`
- `ghcr.io/<owner>/<repo>:pds-plc-dev:<full-git-sha>`

You can also run the workflow manually (**Actions → build-and-push-custom-dev-ghcr → Run workflow**).

When building from a **feature branch**, `pds-plc-dev-latest` is **not** updated (main only). Pass a custom tag so Railway can pin the exact image:

1. Actions → **build-and-push-custom-dev-ghcr** → Run workflow
2. Select your branch (e.g. `fix/sokaa-appview-cdn-url`)
3. Set **image_tag** to e.g. `pds-plc-dev-pr25-cdn`
4. After the run completes, set Railway’s image to `ghcr.io/sokaa-converge/atproto-custom:pds-plc-dev-pr25-cdn` and redeploy manually (auto-redeploy is skipped when `image_tag` is set, because Railway must be pinned to that tag first).

Every manual run still pushes `pds-plc-dev:<full-git-sha>` for the selected commit.

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
