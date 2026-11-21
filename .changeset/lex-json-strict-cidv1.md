---
'@atproto/lex-json': patch
---

Reject CIDv0 `$link` values in strict mode. The AT Protocol data model only uses CIDv1, but `jsonToLex`/`lexParse` with `strict: true` previously accepted CIDv0 links.
