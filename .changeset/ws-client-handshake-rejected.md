---
'@atproto/ws-client': patch
---

A refused upgrade fails with a `HandshakeRejectedError`, a `SocketError` carrying the response's `status` and `headers` (Node.js).
