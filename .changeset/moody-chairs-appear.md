---
"@atproto/bsky": patch
"@atproto/api": patch
"@atproto/ozone": patch
---

Replace optional bskyPostRef fields with hydrated viewBskyPost values on Atmosphere timeline activities and Explore articles and livestreams. Reuse post hydration and viewer visibility checks, omitting unavailable posts without dropping the external content. Refresh consuming contract inputs.
