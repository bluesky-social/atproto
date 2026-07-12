# Sokaa media gateway

Cloudflare Worker that exposes private R2 media objects over the versioned
`GET|HEAD /v1/media/:did/:cid` route. Objects must use the R2 key
`blocks/{did}/{cid}`.

The bucket stays private: clients access it only through the Worker binding
named `MEDIA`. Responses include immutable public caching, credential-free
CORS, object metadata, and single-byte-range support.

## Configuration

Update the production and preview bucket names in `wrangler.toml`, then:

```bash
pnpm --filter @atproto/media-gateway test
pnpm --filter @atproto/media-gateway typecheck
pnpm --filter @atproto/media-gateway exec wrangler deploy
```

Set the AppView environment variable to the Worker's HTTPS origin without a
route suffix:

```text
SOKAA_APPVIEW_CDN_URL=https://media.example.com
```
