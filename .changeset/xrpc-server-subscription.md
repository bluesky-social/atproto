---
'@atproto/xrpc-server': minor
---

**BREAKING:** `Subscription` now takes an explicit set of options rather than arbitrary `ws` `ClientOptions`, and adds a `headers` option for the upgrade request. A subscription also now reconnects on transient close codes (such as a graceful server restart, 1001) where it previously gave up, and `onReconnectError`'s `initialSetup` argument now means "first attempt of this reconnect cycle" rather than "before the first-ever successful connection".

`DisconnectError` is now defined by this package rather than re-exported from the client: it describes how a server route ends a stream it is serving. Aborting a subscription's `signal` now always rejects the iterator with the abort reason — aborting with a `DisconnectError` no longer ends the stream cleanly. To stop deliberately, abort with a sentinel of your own and rethrow anything else:

```ts
const doneReason = new Error('done')
try {
  for await (const msg of sub) { /* ... */ }
} catch (err) {
  if (err !== doneReason) throw err
}
```
