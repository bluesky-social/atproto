---
'@atproto/ws-client': patch
---

Stop retrying WebSocket upgrades the server rejects with a non-transient HTTP status (e.g. `404`) on Node.js. A non-101 response now fails the connection with an `UnexpectedResponseError` (exposing `status` and `statusText`), retried only for 408, 425, 429, 500, 502, 503, 504, 522 and 524.
