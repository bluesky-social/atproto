---
'@atproto/ozone': patch
---

Avoid tag expiry lock contention with reports. Process versioned expiry rows without history scans; leave existing unversioned rows for separate reconciliation.
