---
'@atproto/lex-server': patch
---

Fix `request.signal` being aborted by `@atproto/lex-server/nodejs` as soon as the request body was read. The signal is now aborted when the response closes before completing (e.g. the client disconnected).
