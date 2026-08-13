---
'@atproto/bsky': patch
---

Allow allowlisted feeds to be served by iris instead of their registered feed generator, behind the `iris:feed:enable` gate. Configured with `BSKY_IRIS_FEED_URIS`, which defaults to empty — leaving the routing off.
