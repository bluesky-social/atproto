---
"@atproto/lex-space": minor
---

Check the records yielded by `SpaceReader` consistently. `records()`, `allRecords()`, `list()` and `listAll()` flag each record with `valid`: `true` if it is of a collection declared by the space type and matches the provided schema of its collection, if any; `false` otherwise, with the reason in `error` (a `LexValidationError`). Records stored under a collection other than their `$type` are invalid. Checking `collection` narrows a valid record to its schema's type, or else to a `TypedLexMap` of its collection.

**Breaking:**

- `records()` accepts `collections` (like `allRecords()`) and yields checked records. It no longer accepts `collection` or `excludeValues`: use `listAll()` or `listRecords()`.
- `allRecords()` invalid records include an `error`. With `collections`, it also yields the records of the other declared collections (as `TypedLexMap`s) instead of skipping them.
- `SpaceReader.AllRecordsSchemaItem<T>` is replaced by `SpaceReader.AllRecordsItem<S, T>`.

`list()` and `listAll()` move from `SpaceClient` to `SpaceReader`, where `repo` is required.
