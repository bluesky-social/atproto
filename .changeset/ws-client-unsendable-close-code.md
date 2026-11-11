---
'@atproto/ws-client': patch
---

On Node.js, aborting with a `CloseError` whose code `ws` cannot send closes with `1000`, rather than throwing from the abort listener and leaving the socket closing.
