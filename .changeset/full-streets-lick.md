---
'@atproto/xrpc-server': patch
---

Uses the http res's log Pino logger upon rate limit computation error, allowing to log the failure in the context of an http request
