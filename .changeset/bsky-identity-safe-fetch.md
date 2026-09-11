---
'@atproto/bsky': patch
---

Honor `BSKY_DISABLE_SSRF_PROTECTION` when the AppView resolves identities. The
mock dataplane server used by dev-env takes a `fetch` option for the same
purpose.
