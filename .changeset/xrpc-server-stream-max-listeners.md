---
'@atproto/xrpc-server': patch
---

Raise a response's listener limit before piping a stream into it, so streamed responses no longer log `MaxListenersExceededWarning`.
