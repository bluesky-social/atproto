---
'@atproto/bsky': patch
---

Fetch generic external records in requests of at most 100 entries so large dependency passes, such as Atmosphere Explore galleries, no longer exceed the dataplane limit, and report external hydration traversals that recovered from dependency failures with a `partial` outcome.
