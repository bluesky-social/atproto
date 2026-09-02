---
'@atproto/xrpc-server': minor
---

Cancel in-flight query handlers when the client disconnects. Queries now receive an `AbortSignal` on the handler context that fires when the caller hangs up, so upstream work can be aborted instead of held open. This applies to queries, not procedures.
