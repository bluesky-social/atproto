---
'@atproto/bsky': patch
'@atproto/api': patch
---

Make `app.bsky.embed.getEmbedExternalView` resolve a single canonical record (from `canonicalUri`, or normalized from the legacy `uris` input, which is now optional), validate it against the requested URL before building views, return generic `data` alongside the Standard.site-only legacy `view`, and report records that fail validation in `unverifiedAssociatedRefs`/`unverifiedAssociatedRecords`.
