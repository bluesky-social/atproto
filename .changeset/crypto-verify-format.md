---
'@atproto/crypto': patch
---

Add a `format` option (`'compact'` or `'der'`) to `VerifyOptions`, so a `verifySignature()` caller can accept high-S signatures (`allowMalleableSig`) while still requiring compact encoding.
