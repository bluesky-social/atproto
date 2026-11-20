---
'@atproto/oauth-provider': patch
---

Export `ReplayManager` from `@atproto/oauth-provider/verifier`, with `uniqueSpaceToken()` to reject replayed space delegation tokens and client attestations.
