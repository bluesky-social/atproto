---
'@atproto/bsky': patch
---

Add batched canonical OP thread chains to post hydration so AppView can derive position metadata. Thread roots carrying more OP replies than the per-root ceiling are omitted rather than returned as a truncated chain.
