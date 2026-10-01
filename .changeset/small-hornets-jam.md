---
"@atproto/pds": minor
"@atproto/api": minor
---

Send space repo updates immediately after committing, and persist retryable failed deliveries in the account-manager database for retries with backoff for up to 24 hours. Coalesce retries by repo and space, resetting the backoff and deadline for each newer revision, and coordinate workers with an expiring database lease. Use the shared XRPC retry policy and HTTP status codes to stop retrying permanent failures. A crash before a failed delivery is queued can lose that notification; a later write to the same repo and space repairs it.

Sequence accepted updates and support catch-up through `listRepos(cursor)`. Ignore stale repo revisions and reject timestamps beyond the allowed clock skew.

Distinguish `repoRev` from `spaceRev` in write notifications and writer listings, and use `prevSpaceRev` for the preceding space revision. Syncers paginate and resume listings using `cursor`, which carries the last returned repo entry's `spaceRev`. As with `sync.listRepos`, nonempty pages return a cursor and empty pages omit it.
