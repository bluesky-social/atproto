---
"@atproto/bsky": minor
"@atproto/dev-env": minor
---

Group new-post notifications across accounts in All while keeping individual posts separate in Activity.

Add a notification grouping compute-time histogram with sub-millisecond buckets and an algorithm label.

Track the number of dataplane notification fetches per grouped notifications response.

Rename `notificationsV2MaxReads` to `notificationsV2MaxFetches` and `BSKY_NOTIFICATIONS_V2_MAX_READS` to `BSKY_NOTIFICATIONS_V2_MAX_FETCHES`.
