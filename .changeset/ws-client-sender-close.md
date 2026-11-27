---
'@atproto/ws-client': patch
---

Add `Sender.close(code, reason?)`, which ends one connection with a `CloseError` of `code`, leaving what follows to the reconnect policy. As with an abort, `CloseCode.Abnormal` (`1006`) drops the socket (Node.js), and a code the platform cannot send goes out as `1000`.
