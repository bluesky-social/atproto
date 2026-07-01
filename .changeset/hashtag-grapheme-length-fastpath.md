---
'@atproto/api': patch
---

Fix hashtag length check in `detectFacets` to count grapheme clusters instead of UTF-16 code units, skipping the grapheme count when the UTF-16 length already fits within the limit.
