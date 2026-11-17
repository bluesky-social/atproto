---
'@atproto/oauth-provider': minor
'@atproto/pds': patch
'@atproto/bsky': patch
---

Upgrade `ioredis` to 6.x. By default, the Redis clients these packages create stay on RESP2 and skip `CLIENT SETINFO` on connect, as with `ioredis` 5, and take `ioredis` 6's other new defaults:

- `family` is `0` (was `4`): hostnames resolve to IPv4 or IPv6 addresses, not only IPv4.
- `retryStrategy` waits 50ms × 2^(attempt − 1), up to 5s, plus up to 200ms of jitter, between reconnection attempts (was 50ms × attempt, up to 2s).
- `keepAlive` is `30000`: TCP keepalive probes start after 30s of idle (was off).

The `redis` option of `OAuthProvider` now expects an `ioredis` 6 `Redis` instance, which is used as is, or `RedisOptions`, which can override these defaults.
