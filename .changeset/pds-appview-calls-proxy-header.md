---
"@atproto/pds": patch
---

Honor the `atproto-proxy` header for the calls the PDS itself makes to the AppView while handling a request (`app.bsky.feed.getFeed` record lookup, read-after-write hydration, `com.atproto.identity.resolveHandle`), instead of always using the configured AppView. `resolveHandle` now also resolves the handle directly when the AppView call fails
