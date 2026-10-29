---
"@atproto/bsky": patch
---

Add the feature-gated authenticated Atmosphere timeline with incremental hydration, moderation, whole-batch pagination bounded to five native fetches per request, overflow summaries, page-local grouping, and best-effort viewer subscription lookups. Recheck renderability during pagination and construct final views only after the page is selected, using only the pinned article and its publication for share validation.
