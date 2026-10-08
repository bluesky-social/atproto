---
"@atproto/api": patch
"@atproto/ozone": patch
---

Add report closure target met and missed counts, target met percentages, and overdue pending-report snapshots to report and queue statistics. Exclude reports without closure targets and preserve unavailable historical metrics until recomputed.

Include the updated Ozone report and queue statistics definitions in the generated API client.

Exclude muted reports from current and recomputed historical pending and overdue counts. Inbound volume and closure outcomes continue to include muted reports.
