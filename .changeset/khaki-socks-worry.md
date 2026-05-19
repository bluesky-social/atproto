---
'@atproto/lexicon': patch
---

Fix datetime validation that would reject valid atproto datetime strings (e.g. `1985-04-12T23:20:50.1234567890Z` & `1985-04-12T23:20:50.123+01:45`)
