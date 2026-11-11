---
"@atproto/bsky": patch
"@atproto/api": patch
"@atproto/ozone": patch
---

Add optional hydrated viewBskyPost values alongside existing bskyPostRef fields on Atmosphere timeline activities and Explore articles and livestreams. Reuse post hydration and viewer visibility checks, preserving references and external content when posts are unavailable. Refresh consuming contract inputs.

Keep Explore and the Atmosphere timeline available when optional post hydration fails, omitting incomplete post views while retaining external content and references. Preserve request cancellation and failures for required timeline root posts.
