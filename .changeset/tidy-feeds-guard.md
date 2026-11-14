---
'@atproto/bsky': patch
---

Remove `app.bsky.feed.hydrateFeedSkeleton`. In `app.bsky.feed.getFeed`, forward to the feed generator the service JWT wrapped in BSG's token, and reject service JWTs addressed to neither the feed generator nor AppView.
