---
'@atproto/lex-schema': patch
---

Support `space` definitions.

- `l.space(key, nsid, collections, options?)` declares a space type as a `Space`, inferring its NSID, key type and collections, and throws on an invalid `key`. `options` holds an optional `title` (with `title:lang`) and `description`.
- `Space#keySchema`, `Space#isKey()` and `Space#matchesRef()` validate a space key or ref against the space type, and `Space#spaceRefFor()` builds its `SpaceRef`.
