---
'@atproto/lex-schema': patch
---

`integer()` schemas now accept integers beyond `Number.MAX_SAFE_INTEGER` when validating with `strict: false`. The data model defines integers as 64-bit, so a single such value (e.g. a relay `listHosts` `seq`) no longer makes a whole XRPC response fail validation with `strictResponseProcessing: false`. Strict validation still only accepts safe integers.
