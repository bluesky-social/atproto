---
'@atproto-labs/fetch-node': patch
---

`safeFetchWrap`, `unicastFetchWrap` and `safeDispatchFetchWrap` now return an `AsyncDisposable` fetch function. Disposing it destroys its undici dispatcher, aborting any request still in flight.
