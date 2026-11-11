---
"@atproto/bsky": minor
"@atproto/api": minor
---

Rework Atmosphere timeline groups: replace overflow with complete group item URIs and hydrate only the newest actor-group item. Keep subject groups to one collection and multiple actors, and return article creations as standalone items with collection-specific related activity references and actor profiles.

Require complete actor lists for subject groups and related-activity buckets, preserving the existing record fallbacks when profiles are unavailable.
