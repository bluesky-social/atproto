---
'@atproto-labs/fetch-node': patch
---

unicastFetchWrap now cancels request bodies when throwing an error (to avoid resource leak)
