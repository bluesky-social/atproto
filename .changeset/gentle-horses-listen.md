---
"@atproto/xrpc-server": patch
---

Ensure that service auth JWT headers contain an `alg` claim, and ensure that `typ`, if present, is set to `JWT`.
