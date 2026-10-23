---
'@atproto/bsky': patch
---

Remove the Topics (hot-topic) client. Suggested feeds and starter packs are always served by Iris, and `getSuggestedUsers` falls back to the suggestions service instead of Topics when its Iris gate is off. `BSKY_TOPICS_URL` and `BSKY_TOPICS_API_KEY` are no longer read.
