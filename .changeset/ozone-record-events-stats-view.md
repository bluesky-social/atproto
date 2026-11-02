---
'@atproto/ozone': patch
---

Serve `record_events_stats` as a plain view over `record_events_stats_live` instead of a materialized view, and stop refreshing it in the materialized view refresher
