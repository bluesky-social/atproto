---
'@atproto/ws-client': patch
---

Add a `parseMessage` option to `websocket()`, turning each message into what the stream yields (`undefined` skips it). A throw ends the connection that delivered the message and is classified by `shouldReconnect` like any connection failure.
