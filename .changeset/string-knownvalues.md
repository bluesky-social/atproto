---
'@atproto/lex-schema': patch
'@atproto/lex-builder': patch
---

Add `knownValues` to `StringSchemaOptions` for type-level autocomplete. When `knownValues` is provided, `StringSchema` infers a union of the known literals plus `UnknownString` instead of plain `string`. The builder now emits `knownValues` in generated `l.string()` calls.
