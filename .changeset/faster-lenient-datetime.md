---
'@atproto/syntax': patch
---

Speed up `isDatetimeStringLenient()` by running the cheap AT Protocol datetime check before `iso-datestring-validator`. Results are unchanged.
