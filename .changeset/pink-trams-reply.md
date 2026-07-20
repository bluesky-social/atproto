---
'@atproto/xrpc-server': patch
---

Add the rate limit response headers `RateLimit-Limit`, `RateLimit-Reset`, `RateLimit-Remaining`, `RateLimit-Policy`, and `Retry-After` on 429s to `Access-Control-Expose-Headers` so browser clients can read them on cross-origin requests.
