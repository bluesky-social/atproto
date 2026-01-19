---
'@atproto/lex-schema': patch
---

Remove `default` option from `string`, `integer`, `boolean` and `enum` types. These are replace with a new `withDefault()` type wrapper.
