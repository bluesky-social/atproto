---
'@atproto/lex-rpc': patch
'@atproto/lex': patch
---

Re-export the connection errors of `@atproto/ws-client` from `@atproto/lex-rpc/subscription` (and so from `@atproto/lex`): `CloseCode`, `CloseError`, `SocketError`, `IdleTimeoutError`, `HeartbeatTimeoutError`, `UnexpectedResponseError`, `BufferOverflowError`, `DataModeError`, `WebSocketClientError` and `isReconnectableClose`. They are what a `createWebSocketFactory()`'s `shouldReconnect`, `onReconnect` and `onError` receive for a failed connection, and can now be told apart without depending on `@atproto/ws-client` directly.
