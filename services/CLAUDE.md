# services/ — Production runtime entrypoints

Thin runtime wrappers around the `packages/*` libraries. Each service here is a deployable container: a tiny `index.js` (or `api.js`), a `Dockerfile`, and per-environment env files.

## Services

| Dir | What it runs | Image | Deployed by |
|---|---|---|---|
| `pds/` | `@atproto/pds` | `ghcr.io/w-social-eu/w-social-atproto/pds` | `../../w-social-infrastructure/` (Nomad) |
| `bsky/` | `@atproto/bsky` (API only) | `ghcr.io/.../bsky` | `../../w-social-appview/` (Helm) |
| `dataplane/` | `@atproto/bsky` (data-plane gRPC server) | `ghcr.io/.../dataplane` | `../../w-social-appview/` |
| `bsync/` | `@atproto/bsync` | `ghcr.io/.../bsync` | `../../w-social-appview/` |
| `ozone/` | `@atproto/ozone` | `ghcr.io/.../ozone` | `../../w-social-appview/` (or wherever ozone runs) |

## Conventions

- **Each service is `~50 lines of glue** — load env, build a server from the package, start listening. Logic belongs in `packages/`.
- **Tracing** — `pds/tracer.js` sets up OpenTelemetry. Other services follow the same shape; keep them consistent.
- **PDS env files** — `dot.env.example.quicklogin` is the QuickLogin-flavoured template; real values come from the infra repo's secrets store. Don't check in real `.env`.
- **Dockerfiles** stay minimal. Build steps live in pnpm workspaces, not in the Dockerfile.
- **`run-script.js`** in `pds/` is the one-shot admin entry (migrations, account ops). Invoked by the wadmin CLI.

## When working here

- Adding a runtime feature flag → env var, parsed in `packages/<service>/src/config.ts`, plumbed via `index.js` only as much as needed
- Adding a new service → mirror the layout of `bsync/` (the smallest one)
- Changing the Dockerfile → flag it; deployment in the appview/infrastructure repos may need a matching change
