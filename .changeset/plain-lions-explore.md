---
'@atproto/api': minor
'@atproto/bsky': minor
'@atproto/ozone': minor
---

Keep `featured` as a required, deprecated compatibility field on `app.bsky.unspecced.getAtmosphereExploreTab` article, publication, photo, and livestream items; it is always `false`. Retired content scheduling no longer selects or orders articles, publications, and photos. Livestreams are shown from `previewAt` (or `startsAt`) until `endsAt`, and are reported inactive until `startsAt`. App cards now include an optional `profile` (`app.bsky.actor.defs#profileViewDetailed`) hydrated from the app's account, whose avatar and banner back `logo` and `backgroundImage`.
