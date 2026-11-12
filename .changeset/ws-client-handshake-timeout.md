---
'@atproto/ws-client': patch
---

Add the `handshakeTimeoutMs` option, which ends a dial whose opening handshake has not completed in time with a `HandshakeTimeoutError`.
