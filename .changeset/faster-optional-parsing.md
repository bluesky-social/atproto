---
'@atproto/lex-schema': patch
---

Speed up parsing of absent optional values. `OptionalSchema` now works out once whether its inner schema accepts `undefined` (eg. because it applies a default), instead of running it, and building then discarding a `LexValidationError`, for every absent optional value.
