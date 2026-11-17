---
'@atproto/lex-schema': minor
---

Support `space` definitions.

- `l.space(key, type, collections)` declares a space type as a `Space`, inferring its key type, type (NSID, as `Space#type`) and collections, and throws on an invalid `key`. `collections` lists the `RecordSchema`s of the recommended collections, or `l.typedRef()`s to them (their types are only inferred from a list of either form). `Space#collections` returns the record schemas, resolved on first access.
- `Space#keySchema`, `Space#isKey()` and `Space#matchesRef()` validate a space key or ref against the space type, and `Space#spaceRefFor()` builds its `SpaceRef`.
