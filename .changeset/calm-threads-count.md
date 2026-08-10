---
'@atproto/bsky': patch
---

Add batched canonical OP thread metadata to post hydration. Thread roots carrying more OP replies than the per-root ceiling are omitted rather than numbered from a truncated reply set.
