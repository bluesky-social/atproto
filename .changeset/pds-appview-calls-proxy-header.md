---
"@atproto/pds": patch
---

Honor the `atproto-proxy` header for the calls the PDS itself makes to the AppView while serving `app.bsky.feed.getFeed` and read-after-write responses, instead of always using the configured AppView. `com.atproto.identity.resolveHandle` now resolves the handle directly when the AppView cannot answer, and service proxies requests that carry an `atproto-proxy` header (authentication required)
