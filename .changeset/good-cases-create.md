---
'@atproto/lex-client': patch
'@atproto/lex': patch
---

Add `client.subscribe()` and `client.subscribeRepos()`, subscribing to XRPC subscriptions through the client's agent. `subscribeRepos()` resumes from the last received `seq` across reconnects.
