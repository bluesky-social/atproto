---
'@atproto/lex-json': patch
---

Serialize and parse Lexicon data without recursion, enforcing configurable limits on nesting depth, container length and string length. Unlike `JSON.stringify`, `lexStringify` no longer throws a `RangeError` on deeply nested data.
