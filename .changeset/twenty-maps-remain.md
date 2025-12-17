---
'@atproto/lex-schema': patch
---

Add `check()` method to all Schema classes. That method is an alias for the `assert()` method that allows to avoid `ts(2775)` errors.
