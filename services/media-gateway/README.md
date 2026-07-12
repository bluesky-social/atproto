# Sokaa media gateway

Cloudflare Worker that exposes private R2 media objects over the versioned
`GET|HEAD /v1/media/:did/:cid` route. Objects must use the R2 key
`blocks/{did}/{cid}`.

The bucket stays private: clients access it only through the Worker binding
named `MEDIA`. Responses include immutable public caching, credential-free
CORS, object metadata, and single-byte-range support.

## Configuration

Update the production and preview bucket names in `wrangler.toml` if needed.

### CI deploy (preferred)

Push to `main` under `services/media-gateway/**` (or run the
`deploy-media-gateway` workflow manually). GitHub Actions installs only this
package’s dependency tree and runs `wrangler deploy`.

Required repository secrets:

- `CLOUDFLARE_API_TOKEN` — token with Workers Scripts Edit + Account read
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account id

Do **not** use Cloudflare Workers Builds / Git integration for this repo: it
always runs a full-monorepo `pnpm install`, which fails on native deps
(`better-sqlite3`). Disconnect any Workers Builds connection for this Worker.

### Manual deploy

```bash
pnpm --filter @atproto/media-gateway test
pnpm --filter @atproto/media-gateway typecheck
pnpm --filter @atproto/media-gateway deploy
```

Set the AppView environment variable to the Worker's HTTPS origin without a
route suffix:

```text
SOKAA_APPVIEW_CDN_URL=https://media.example.com
```
