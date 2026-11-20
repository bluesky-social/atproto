---
'@atproto/lex-schema': patch
---

Speed up parsing of absent optional values. `OptionalSchema` now works out once whether its inner schema replaces `undefined` with a value (eg. a default), and only runs it on absent values when it does, instead of running it (and building then discarding a `LexValidationError`) for every absent optional value.
