# `@atproto/video-processing`

Cloudflare Stream job contract for Sokaa video embeds.

## Responsibilities

- Idempotent submit keyed by `did + videoCid`
- Readiness gate before `ready` (playlist HEAD/GET + first segment when possible)
- Retryable vs permanent failure categories
- Stream delete for moderation/account takedown (< 1 hour SLA)
- Same-origin `/v1/media` source URL allowlist for Stream copy

## AppView integration

Sokaa AppView stores rows in `video_asset` and exposes:

- `POST /_sokaa/video/jobs` — admin Basic auth
- `DELETE /_sokaa/video/jobs/:did/:cid` — admin Basic auth
- `POST /_sokaa/video/webhooks/stream` — `SOKAA_STREAM_WEBHOOK_SECRET`
  via `Authorization: Bearer …` or `X-Sokaa-Webhook-Secret`

Required env (never commit):

- `SOKAA_STREAM_ACCOUNT_ID`
- `SOKAA_STREAM_API_TOKEN`
- `SOKAA_STREAM_CUSTOMER_SUBDOMAIN` (full origin
  `https://customer-xxx.cloudflarestream.com`, or bare code `xxx`)
- `SOKAA_STREAM_WEBHOOK_SECRET`
- AppView admin Basic auth uses `SOKAA_APPVIEW_ADMIN_PASSWORD` or
  `PDS_ADMIN_PASSWORD` (dev-env falls back to `admin-pass`)
- Production ops hit jobs via the PDS public origin:
  `POST https://<pds>/_sokaa/video/jobs` (proxied to the bundled AppView)

### Customer subdomain (no videos yet)

Your account has a stable `customer-<CODE>.cloudflarestream.com` host. Easiest
ways to learn it:

1. Open [Stream → Videos](https://dash.cloudflare.com/?to=/:account/stream/videos)
   — the dashboard shows your unique customer code (also referenced in CSP docs).
2. Or upload any tiny MP4 once, open the video, copy the HLS Manifest URL, and
   keep the `https://customer-….cloudflarestream.com` prefix.

### Webhook secret

`SOKAA_STREAM_WEBHOOK_SECRET` is **our** shared secret for
`POST /_sokaa/video/webhooks/stream` (Bearer or `X-Sokaa-Webhook-Secret`).
Generate it yourself, e.g. `openssl rand -hex 32`. Cloudflare Stream’s native
webhook uses a different signing scheme; until a proxy verifies Stream’s
signature and forwards with this secret, prefer admin job re-submit / smoke
polling for readiness.

## Cost / policy

See `sokaa` ADR `docs/decisions/video-processing.md`:

- Steady ceiling $150/mo (bootstrap toward $500/mo)
- Deletion SLA < 1 hour via Stream Delete API + R2 prefix purge
