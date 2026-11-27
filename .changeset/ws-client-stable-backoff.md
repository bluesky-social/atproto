---
'@atproto/ws-client': patch
---

Only start the reconnect backoff over after a connection that stayed up for `stableAfterMs` (a new option, default `5000`), rather than after any connection that opens. An endpoint that accepts connections and then fails them right away (an error frame, an immediate close, a message the consumer rejects with `throw()`) is now retried with an escalating backoff instead of every ~1s. `stableAfterMs: 0` restores the previous behavior.
