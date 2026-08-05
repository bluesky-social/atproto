---
'@atproto/lex-schema': minor
---

Fix `TypedObjectSchema.isTypeOf` to return `false` when `$type` is `undefined` or missing, matching the behavior of `RecordSchema.isTypeOf`
