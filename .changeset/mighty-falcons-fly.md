---
'@atproto/api': patch
'@atproto/bsky': patch
'@atproto/ozone': patch
---

Add optional `photoCount` to gallery views using the dataplane's total `social.grain.gallery.item` backlink count, independently of the hydrated preview items.
