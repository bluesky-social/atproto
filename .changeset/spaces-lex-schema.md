---
'@atproto/lex-schema': minor
---

Support `space` definitions.

- `l.space(key, spaceType, collections)` declares a space type as a `Space` (with `type: 'space'`), inferring its key type, space type (NSID, as `Space#spaceType`) and collections, and throws on an invalid `key`. `collections` lists the `RecordSchema`s of the recommended collections, or `l.typedRef()`s to them (their types are only inferred from a list of either form). `Space#collections` returns the record schemas, resolved on first access.
- `Space#keySchema`, `Space#isKey()` and `Space#matchesRef()` validate a space key or ref against the space type, and `Space#spaceRefFor()` builds its `SpaceRef`.
