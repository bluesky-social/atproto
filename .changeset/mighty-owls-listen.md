---
"@atproto/bsky": patch
---

Revert the internal `GetPostViewCounts` dataplane contract (added in 0.5.4, #5815) and replace it with a batched `GetFeatures` RPC, so the AppView can read feature-store entries (keyed by store type and UID) from Atlantis.
