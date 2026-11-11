---
"@atproto/bsky": patch
"@atproto/api": patch
"@atproto/ozone": patch
---

Add optional hydrated viewBskyPost values alongside existing bskyPostRef fields on Atmosphere timeline activities and Explore articles and livestreams. Reuse post hydration and viewer visibility checks, preserving references and external content when posts are unavailable. Refresh consuming contract inputs.
