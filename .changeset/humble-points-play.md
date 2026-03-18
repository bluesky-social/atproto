---
'@atproto/lex-schema': patch
---

`LexValidationError` class now implements `ResultFailure` allowing it to be used as validation return value directly (without the need to be wrapped)
