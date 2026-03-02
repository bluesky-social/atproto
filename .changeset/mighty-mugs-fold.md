---
'@atproto/lex-client': patch
---

Rename `matchesSchema` to `matchesSchemaErrors` to make it more explicit what is being matched when called on an XRPC "result" (that could either represent a success or failure)
