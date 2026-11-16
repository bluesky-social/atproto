---
'@atproto/oauth-provider': minor
'@atproto/pds': patch
'@atproto/bsky': patch
---

Upgrade `ioredis` to 6.x, keeping the 5.x wire behavior (RESP2, no `CLIENT SETINFO`) for the clients these packages create. The `redis` option of `OAuthProvider` now expects an `ioredis` 6 `Redis` instance (or options).
