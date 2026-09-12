---
'@atproto/pds': patch
---

Honour the `atproto-proxy` header when resolving the feed generator in `app.bsky.feed.getFeed`, when hydrating record embeds during read-after-write, and in the `getPostThread` not-found fallback, instead of always using the configured app view. Register `app.bsky.actor.getPreferences`/`putPreferences` and the other `app.bsky.*` handlers even when no app view is configured, so a PDS without `PDS_BSKY_APP_VIEW_URL` still serves preferences locally and proxies explicitly targeted requests.
