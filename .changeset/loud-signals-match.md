---
"@atproto/lex-server": patch
---

Detect request aborts with `isCausedBySignal` from `@atproto/lex-rpc`: an error that is a non-`Error` abort reason, or that has the abort reason deeper in its cause chain, now produces a 499 and is not reported to `onHandlerError` or `onSocketError`
