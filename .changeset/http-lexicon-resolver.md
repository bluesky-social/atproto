---
"@atproto/lex-installer": patch
---

Add an `http` lexicon resolver that fetches schemas from a web base URL (`<base>/<...nsid.segments>.json`), e.g. a raw Git host. A 404 falls through to the next resolver; other non-ok statuses throw.
