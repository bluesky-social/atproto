---
"@atproto/oauth-client": patch
---

Fix the DPoP nonce retry for authorization server requests on React Native, where the first sign-in (or a token refresh with no cached nonce) failed with `use_dpop_nonce`. Unexpected errors while checking for a `use_dpop_nonce` response are no longer treated as "not a nonce error".
