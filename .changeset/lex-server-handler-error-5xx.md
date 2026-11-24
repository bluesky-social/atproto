---
'@atproto/lex-server': patch
---

`onHandlerError` is now only called for server errors (5xx), as documented. Client errors (4xx), such as invalid params or input, authentication failures, or a `LexServerError` with a 4xx status thrown by a handler, are no longer reported.
