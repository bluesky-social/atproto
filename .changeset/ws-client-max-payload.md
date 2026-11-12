---
'@atproto/ws-client': patch
---

Add the `maxPayload` option (Node.js): a larger message fails the connection with a `MessageTooBigError` and a `1009` close.
