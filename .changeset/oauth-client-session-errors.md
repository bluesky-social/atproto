---
'@atproto/oauth-client': minor
---

`isExpectedSessionError()` no longer matches every `TypeError`, which is also how `fetch` reports a network failure.
