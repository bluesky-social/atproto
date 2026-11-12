---
'@atproto/lex-client': patch
'@atproto/lex': patch
---

Add `subscribeRepos()`, subscribing to the `com.atproto.sync.subscribeRepos` event stream (firehose) of a service and resuming from the last received `seq` across reconnects.
