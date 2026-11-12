---
'@atproto/ws-client': minor
---

Add `Sender.close(code, reason?)`, which ends one connection with a `CloseError` of `code`, leaving what follows to the reconnect policy.
