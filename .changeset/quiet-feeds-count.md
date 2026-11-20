---
'@atproto/bsky': patch
---

getFeed rejects service JWTs whose `aud` doesn't match their `lxm`: the feed generator for getFeedSkeleton, AppView for getFeed.
