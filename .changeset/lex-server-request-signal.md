---
'@atproto/lex-server': patch
---

Fix the Node.js adapter aborting `request.signal` when a request body finishes streaming. `req` `end`/`close` fire on normal completion, so any POST whose body was consumed had an already-aborted signal during handling (surfacing as HTTP 499 `RequestAborted` in XRPC apps). The signal now tracks genuine client disconnects: socket close, request error, or an incomplete request closing early.
