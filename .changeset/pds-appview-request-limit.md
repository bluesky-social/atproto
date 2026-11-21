---
'@atproto/pds': patch
---

Limit how fast the PDS sends requests to its configured AppView. Until now every proxied `app.bsky.*` call was forwarded at once, so a PDS with many active users sent a burst of several times its normal rate whenever its clients reconnected together, for example after a restart. Each PDS process now sends at most 300 requests per second to the AppView and keeps at most 100 in flight. Requests over either limit wait in a queue of up to 1500 for up to 5 seconds; beyond that the PDS answers `429 RateLimitExceeded` with a randomised `Retry-After`, without contacting the AppView. The limit covers every request the PDS sends to the AppView: the ones it proxies, and the ones its own handlers make (the feed record lookup in `getFeed`, `resolveHandle`, `registerPush`, `unregisterPush`, and the lookups that fill in a user's own recent writes). A lookup of that last kind that is turned away is skipped, and the response is returned without it. Requests to other services (`atproto-proxy`) are not limited.

The limits are set with `PDS_BSKY_APP_VIEW_MAX_REQUESTS_PER_SECOND` (default `300`, `0` for no limit), `PDS_BSKY_APP_VIEW_MAX_CONCURRENT_REQUESTS` (default `100`, `0` for no limit), `PDS_BSKY_APP_VIEW_MAX_QUEUED_REQUESTS` (default `1500`) and `PDS_BSKY_APP_VIEW_MAX_QUEUE_MS` (default `5000`). The defaults suit a PDS of tens of thousands of active accounts; the most that can reach the AppView in one second is the rate plus the concurrency cap.

Two OpenTelemetry metrics report what the limit does: the histogram `appview.request.limit.wait` (milliseconds each request to the AppView waited; 0 when it was sent at once) and the counter `appview.request.limit.rejected` (requests the limit turned away, by `reason`: `queue_full` or `queue_timeout`).

Removing or raising the rate limit is likely to hit service limits on Bluesky systems. Bluesky's network edge answers a breach with a temporary block of the PDS's address (about an hour), during which none of its users can load timelines, profiles or notifications.
