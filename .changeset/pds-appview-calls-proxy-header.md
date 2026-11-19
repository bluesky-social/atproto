---
"@atproto/pds": patch
---

Honor the `atproto-proxy` header for the calls the PDS itself makes to the AppView while serving read-after-write responses, instead of always using the configured AppView. `app.bsky.feed.getFeed` and `com.atproto.identity.resolveHandle` now fall back to a direct lookup (the feed generator record from its repo's PDS, direct handle resolution) when the AppView cannot answer. `resolveHandle` also service proxies requests that carry an `atproto-proxy` header (authentication required)
