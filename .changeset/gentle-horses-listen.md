---
"@atproto/xrpc-server": patch
---

Ensure that service auth JWT headers contain an `alg` claim, and ensure that `typ`, if present, is not an unexpected type (e.g. not an access or DPoP token).
