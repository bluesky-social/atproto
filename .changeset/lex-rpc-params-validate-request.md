---
'@atproto/lex-rpc': minor
'@atproto/lex-client': minor
---

**Breaking:** `validateRequest: false` now also skips validating an XRPC request's params and applying their defaults, which are then sent as given. Since `Client` defaults `validateRequest` to `false`, its requests no longer validate params unless `validateRequest` is set.
