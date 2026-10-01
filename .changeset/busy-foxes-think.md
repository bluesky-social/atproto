---
"@atproto/bsky": minor
---

Return grouped notification related views as a typed union array and include views for the first ten items per group.

Remove the `utcOffset` parameter and separate notification groups at a rolling 24-hour cutoff, including multi-post-like spotlights.
