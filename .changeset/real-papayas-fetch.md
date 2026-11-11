---
'@atproto/bsky': patch
'@atproto/api': patch
'@atproto/ozone': patch
---

Use Iris Grain gallery recommendations in Atmosphere Explore behind `atmosphere_explore:galleries:iris:enable`, independently of article recommendations. Return the gallery recommendation ID in `photos.recIdStr`. Retain curated photos when Iris returns an empty list or fails.

Update the shared Explore contract description for recommended photo galleries.
