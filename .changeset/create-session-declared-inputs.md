---
'@atproto/pds': patch
---

`com.atproto.server.createSession` now passes only its declared inputs to `AccountManager.login()`, rather than forwarding undeclared properties from the request body as login options.
