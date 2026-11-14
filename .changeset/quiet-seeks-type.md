---
'@atproto/bsky': patch
---

Add `BSKY_TYPEAHEAD_URL`: when set, `app.bsky.actor.searchActorsTypeahead` gets its skeleton from that `bsky.Service` host's `SearchActorsTypeahead` for requests with the `search:typeahead_service:enable` gate on, instead of the dataplane or search service; other requests are unchanged. Add `BSKY_TYPEAHEAD_PROHIBITED_TERMS_FILE`, the prohibited search terms CSV: on that path, a query matching an active Block rule returns no actors without calling the host.
