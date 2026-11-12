---
'@atproto/ws-client': patch
---

A close code of `1006` (`CloseCode.Abnormal`), as a `CloseError` abort reason or passed to `Sender.close()`, drops the socket without a closing handshake (Node.js).
