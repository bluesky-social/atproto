---
'@atproto/api': patch
'@atproto/bsky': patch
'@atproto/ozone': patch
'@atproto/pds': patch
---

Add `since` and `startCursor` to `getTimeline` and `getListFeed`, for reading everything strictly newer than a previously returned position.
