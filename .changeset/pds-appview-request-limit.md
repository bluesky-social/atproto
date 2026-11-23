---
'@atproto/pds': patch
---

Add optional limits on requests from the PDS to its configured AppView. Set `PDS_BSKY_APP_VIEW_MAX_REQUESTS_PER_SECOND` or `PDS_BSKY_APP_VIEW_MAX_CONCURRENT_REQUESTS` to enable them; both default to `0` (no limit). Requests over a limit wait in a bounded queue, then receive a 429 response with `Retry-After` if the queue is full or the wait expires.

`PDS_BSKY_APP_VIEW_MAX_QUEUED_REQUESTS` sets the queue size (default `1500`), and `PDS_BSKY_APP_VIEW_MAX_QUEUE_MS` sets the maximum wait in milliseconds (default `5000`). Setting either to `0` prevents waiting.

When limits are enabled, the OpenTelemetry histogram `appview.request.limit.wait` records wait times in milliseconds, including `0` for requests sent immediately. The counter `appview.request.limit.rejected` counts rejected requests by reason: `queue_full` or `queue_timeout`.
