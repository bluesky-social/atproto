---
'@atproto/lex-schema': patch
---

Remove `default` option from `string`, `integer`, `boolean`, `enum` and `literal` types. These are replace with a new `withDefault()` type wrapper.
