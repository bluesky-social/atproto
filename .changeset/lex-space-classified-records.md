---
"@atproto/lex-space": minor
---

Check the records yielded by `SpaceReader` consistently, against the space type's schemas. `records()`, `allRecords()`, `list()` and `listAll()` flag each record with `valid`: `true` if it is of a collection declared by the space type and matches the space type's schema of that collection; `false` otherwise, with the reason in `error` (a `LexValidationError`). Records stored under a collection other than their `$type` are invalid. Checking `collection` narrows a valid record to its schema's type.

**Breaking:**

- `records()` yields checked records. It no longer accepts `collection` or `excludeValues`: use `listAll()` or `listRecords()`.
- `allRecords()` no longer accepts `collections`: every record is validated against the space type's schema of its collection. Invalid records include an `error`.
- `SpaceReader.AllRecordsSchemaItem<T>` is replaced by `SpaceReader.AllRecordsItem<S>`.
- The typed methods only accept the collections declared by the space type, and rely on the space type's schemas of those collections: `validateRequest: false` no longer allows other collections. Use the lower level methods (`createRecord()`, …) for those.
- `get()`, `delete()`, `list()` and `listAll()` take the NSID of the collection (e.g. `get(com.example.post.$type, { rkey })`) instead of a schema.
- `create()` and `put()` take the record (e.g. `create(com.example.post.$build({ text }))`) instead of a schema and its input, and always validate it against the space type's schema of its collection.
- The `applyWrites()` operation helper follows the same rules: `op.create(record)`, `op.update(record, { rkey })` and `op.delete(collection, { rkey })`, and `op.getSchema(collection)` returns the space type's schema of a collection. Operations built by hand are still accepted.
- `SpaceCollectionSchema<S, T>` is removed. `SpaceCollection<S>` is the NSID of a collection of `S`, `SpaceRecordSchema<S, C>` its record schema, and `SpaceRecordInput<S, C>` a record of it.

`list()` and `listAll()` move from `SpaceClient` to `SpaceReader`, where `repo` is required.
