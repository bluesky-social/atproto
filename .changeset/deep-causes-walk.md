---
"@atproto/lex-rpc": patch
---

`isCausedBySignal` matches the abort reason anywhere in the error's cause chain (up to 8 levels), not only as the error itself or its direct cause
