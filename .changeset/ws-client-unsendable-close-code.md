---
'@atproto/ws-client': patch
---

On Node.js, aborting with a `CloseError` whose code `ws` cannot send no longer throws from the abort listener and leaves the socket closing: `1006` (`CloseCode.Abnormal`) drops the socket without a closing handshake, and any other such code closes with `1000`.
