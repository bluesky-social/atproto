---
'@atproto/ws-client': patch
---

Add the `stableConnectionMs` option: the reconnect backoff only starts over after a connection that stayed open that long.
