---
"@atproto/bsky": minor
"@atproto/api": minor
"@atproto/ozone": patch
---

Replace optional bskyPostRef fields with hydrated viewBskyPost values on Atmosphere timeline activities and Explore articles and livestreams. Reuse post hydration and viewer visibility checks, omitting unavailable posts without dropping the external content. Refresh consuming contracts and define the optional external embed modality data already emitted by AppView.
