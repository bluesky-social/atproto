---
'@atproto/syntax': patch
---

Fixes a bug where `normalizeDatetime` would return different results for the same input depending on the timezone of the machine it was run on. This caused tests to fail when run in different environments. The fix is to first use a fixed timezone (UTC) when normalizing datetimes, ensuring consistent results regardless of the machine's local timezone.
