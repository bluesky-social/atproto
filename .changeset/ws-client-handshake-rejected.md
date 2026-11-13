---
'@atproto/ws-client': patch
---

On Node.js, a refused upgrade fails with a `HandshakeRejectedError`, a `SocketError` carrying the response's `status` and `headers`, rather than a plain `SocketError` with the status only in its `cause`'s message.
