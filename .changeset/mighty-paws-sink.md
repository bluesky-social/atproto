---
'@atproto/lex-schema': patch
---

Remove options (`required`, `nullable`) from `object` schemas. Those are replaced by `l.optional` and `l.nullable` wrappers.
