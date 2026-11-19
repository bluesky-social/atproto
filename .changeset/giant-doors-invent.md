---
"@atproto/lex-schema": patch
---

Support `RecordSchema` in `typedUnion()`, without the need to wrap them inside `typedRef()`. `typedUnion()` now supports any `Validator` that has a `$type: string` property and validates objects with a `$type` property (exported as a new `TypedUnionValidator` interface)
