---
'@atproto/lex-json': patch
---

Reject CIDv0 `$link` values in strict mode. `jsonToLex`, `lexParse`, and `lexParseJsonBytes` now require parsed `$link` CIDs to be version 1 when `strict: true`, matching the AT Protocol data model; CIDv0 remains accepted in non-strict mode.
