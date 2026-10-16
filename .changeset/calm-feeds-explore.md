---
"@atproto/bsky": minor
"@atproto/api": minor
---

Breaking: `app.bsky.unspecced.getAtmosphereExploreTab` now returns `articles`, `publications`, `photos`, and `livestreams` as `{ items, recIdStr? }` section objects instead of arrays, and adds the `app.bsky.unspecced.getAtmosphereExploreArticleRecommendations` skeleton lexicon. AppView adds a bounded Iris article-recommendation client helper and the `atmosphere_explore:articles:iris:enable` feature gate declaration.
