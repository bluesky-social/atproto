---
"@atproto/pds": patch
---

Resolve locally hosted OAuth permission-set Lexicons using local repository proofs instead of fetching the PDS public hostname. This avoids failures when self-fetches are blocked by local networking or SSRF protection, while retaining DID authority, signature and schema validation, and account availability checks.
