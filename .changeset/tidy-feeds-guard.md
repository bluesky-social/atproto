---
'@atproto/bsky': patch
---

In `app.bsky.feed.getFeed`, forward to the feed generator the service JWT wrapped in BSG's token.
