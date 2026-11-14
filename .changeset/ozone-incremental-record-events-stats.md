---
'@atproto/ozone': patch
---

Add `record_events_stats_live`, which a daemon worker keeps current from deltas queued by triggers on `moderation_event` and a batched backfill of earlier events, ahead of serving `record_events_stats` from it instead of a materialized view
