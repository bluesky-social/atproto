---
'@atproto/ws-client': patch
---

Add `createWebSocketFetch()`, wrapping a `fetch` so that a WebSocket handshake request (a `GET` with an `Upgrade: websocket` header) opens a WebSocket, sending the request headers, and resolves with a `101` `WebSocketResponse` (or the server's response to a refused upgrade). A `websocket()` url function can now perform the handshake itself through such a fetch, and return its response: the handshake then goes through whatever wraps the fetch (credentials, retries).
