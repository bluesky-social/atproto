---
'@atproto/xrpc-server': minor
---

**BREAKING:** `Subscription` no longer accepts arbitrary `ws` `ClientOptions` — its options are now an explicit set (`service`, `method`, `validate`, `getParams`, `signal`, `maxReconnectSeconds`, `heartbeatIntervalMs`, `onReconnectError`, plus a new `headers` field for request headers). Reconnection behavior also changes with the move to `@atproto/ws-client`'s `websocket()`: a subscription now reconnects after graceful server restarts (close code 1001) and other transient close codes where it previously gave up, and `onReconnectError`'s `initialSetup` argument now means "the first attempt of this reconnect cycle" rather than "before the first-ever successful connection". `DisconnectError` is now defined and exported by this package (previously re-exported from `@atproto/ws-client`), and it no longer means anything to a *client*: it describes how a server route ends a stream it is serving. Aborting a subscription's `signal` now always rejects the iterator with the abort reason, where previously aborting with a `DisconnectError` ended the stream cleanly — so there is no clean-stop-via-signal idiom any more. To stop a subscription deliberately, abort with a sentinel of your own and rethrow anything else:

```ts
const doneReason = new Error('done')
try {
  for await (const msg of sub) { /* ... */ }
} catch (err) {
  if (err !== doneReason) throw err
}
```
