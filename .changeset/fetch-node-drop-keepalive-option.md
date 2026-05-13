---
'@atproto-labs/fetch-node': minor
---

**BREAKING:** `unicastFetchWrap` and `safeFetchWrap` no longer accept `dangerouslyForceKeepAliveAgent` — on Node.js 22+ the keep-alive dispatcher is always used via `new Request(input, { dispatcher })`, so the option was a no-op.
