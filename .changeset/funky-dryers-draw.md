---
"@atproto/space": patch
"@atproto/pds": patch
"@atproto/crypto": patch
---

Replace space credential DPoP binding with HTTP message signatures over the authorization token and audience DID, using P-256 did:key confirmation keys.

Add a signature format option to the shared crypto verifier so callers can accept high-S signatures while requiring compact encoding.
