---
'@atproto/bsky': patch
---

Replace custom hydration in `getAtmosphereExploreTab` with generic external-view hydration, using the first URI in each worker group as its canonical root and discovering dependencies automatically.
