---
'@atproto/bsky': patch
---

Add `BSKY_TYPEAHEAD_URL`: when set, `app.bsky.actor.searchActorsTypeahead` gets its skeleton from that `bsky.Service` host's `SearchActorsTypeahead` for every request, instead of the dataplane or search service.
