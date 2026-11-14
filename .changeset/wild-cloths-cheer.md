---
'@atproto/ws-client': patch
---

A function-valued `url` that throws (or rejects) now fails that connection attempt: the error is classified by `shouldReconnect` and reported to `onReconnect` or `onError`, like any connection failure, instead of rejecting the stream directly.
