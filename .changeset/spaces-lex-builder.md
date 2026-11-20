---
'@atproto/lex-builder': minor
---

Generate `l.space()` schemas for `space` definitions, whose collections are `l.typedRef()`s to the generated record schemas, and export their NSID as `$spaceType`. Building a space fails if one of its collections is not a record.
