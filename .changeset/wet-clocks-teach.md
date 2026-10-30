---
"@atproto/bsky": patch
---

Add the feature-gated authenticated Atmosphere timeline with incremental hydration, moderation, whole-batch pagination bounded to five native fetches per request, overflow summaries, and page-local grouping using the activity item/group definitions. Share best-effort, request-cached viewer publication subscriptions across external and post hydration. Recheck renderability during pagination using shared availability checks plus timeline-specific loaded-profile and no-mutes policy; construct final views only after the page is selected, using only the pinned article and its publication for share validation.
