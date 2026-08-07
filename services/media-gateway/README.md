# Sokaa media gateway

Cloudflare Worker that exposes private R2 media objects over versioned routes:

| Route                           | R2 key                | Notes                                                                          |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------------ |
| `GET\|HEAD /v1/media/:did/:cid` | `blocks/{did}/{cid}`  | Original blobs (images, MP4 uploads)                                           |
| `GET\|HEAD /v1/hls/:did/:cid/*` | `video/{did}/{cid}/…` | Mirrored HLS (`.m3u8` → `application/vnd.apple.mpegurl`, `.ts` → `video/mp2t`) |

Allowed HLS asset paths: `master.m3u8`, `poster.jpg`, `status.json`,
`v{bitrate}/index.m3u8`, `v{bitrate}/segN.ts`.

The bucket stays private: clients access it only through the Worker binding
named `MEDIA`. Responses include immutable public caching, credential-free
CORS, object metadata, and single-byte-range support.

## Video / HLS

Canonical processing ADR (vendor Stream, cost, deletion SLA):
`sokaa` repo `docs/decisions/video-processing.md`.

Raw `/v1/media` MP4 delivery is **not** an HLS readiness signal. AppView emits
`playlist` only when Cloudflare Stream (or a mirrored master under `/v1/hls`)
is ready.

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
SOKAA_APPVIEW_CDN_URL=https://sokaa-media-gateway.sokaa-media.workers.dev
```

AppView appends `/v1/media/:did/:cid` (and optional `/v1/hls/...`) itself —
do not include those paths in the env var.
