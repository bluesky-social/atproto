---
'@atproto/bsky': patch
---

Add `BSKY_TYPEAHEAD_URL`: when set, `app.bsky.actor.searchActorsTypeahead` gets its skeleton from that `bsky.Service` host's `SearchActorsTypeahead` for every request, instead of the dataplane or search service. Add `BSKY_TYPEAHEAD_PROHIBITED_TERMS_FILE`, the prohibited search terms CSV: on that path, a query matching an active Block rule returns no actors without calling the host.
