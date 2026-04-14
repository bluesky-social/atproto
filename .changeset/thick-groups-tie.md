---
'@atproto/syntax': patch
---

Fixes a bug where `normalizeDatetime` would return different results for the same input depending on the timezone of the machine it was run on. This caused tests to fail when run in different environments. The fix consists of attempting more consistent parsing strategies first (appending "Z" or " UTC" to the input) before falling back to parsing "as is", which can yield different results depending on the local timezone. The function's documentation has also been updated to reflect this behavior.
