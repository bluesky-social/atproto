---
"@atproto/bsky": minor
"@atproto/api": minor
---

Update Atmosphere Explore recommendations and curated content selection:

- **Breaking:** `app.bsky.unspecced.getAtmosphereExploreTab` returns `articles`, `publications`, `photos`, and `livestreams` as `{ items, recIdStr? }` section objects instead of arrays.
- Add the `app.bsky.unspecced.getAtmosphereExploreArticleRecommendations` skeleton lexicon and source articles from Iris behind the `atmosphere_explore:articles:iris:enable` gate, returning the recommendation ID on `articles.recIdStr`. If the Iris request fails or returns a malformed response, fall back to worker-curated articles without a recommendation ID. With the gate off, retain worker-curated articles.
- Select curated content by location and request topics, prioritize active featured windows, and cap each curated section at 10 groups before hydrating each group's `canonicalUri`. Every list, including apps, returns at most 10 items, Iris is asked for 10 articles, and each selected list is shuffled with featured items first.
- Skip malformed worker banners, content entries, and app cards instead of failing the request, keeping valid items and sections.
- Select a single active announcement banner by location, falling back to the untargeted banner with the latest expiration.
