---
'@atproto/lex-server': patch
---

On Node.js, a request upgraded to a WebSocket now has a 101 `statusCode` on its `ServerResponse` once the handshake completes. HTTP server metrics, which read it when the response closes, no longer report subscriptions as 200 responses lasting the whole connection.
