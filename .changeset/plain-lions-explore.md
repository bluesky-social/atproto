---
'@atproto/api': minor
'@atproto/bsky': minor
'@atproto/ozone': minor
---

Remove the `featured` field from `app.bsky.unspecced.getAtmosphereExploreTab` article, publication, photo, and livestream items, and stop using content scheduling to select or order articles, publications, and photos. Livestreams are shown from `previewAt` (or `startsAt`) until `endsAt`, and are reported inactive until `startsAt`. App cards now include an optional `profile` (`app.bsky.actor.defs#profileViewDetailed`) hydrated from the app's account, whose avatar and banner back `logo` and `backgroundImage`.
