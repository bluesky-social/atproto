---
'@atproto/lex-schema': patch
---

Distinguish "parse" and "validation" modes when checking against a schema. Validation (`validate()` and `safeValidate()`) only ensures that a value matches the input schema, while parsing (`parse()` and `safeParse()`) will also apply defaults and coerce input values into the expected output type.
