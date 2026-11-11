---
'@atproto/oauth-client': minor
---

`isExpectedSessionError()` no longer matches every `TypeError`, which is also how `fetch` reports a network failure. A malformed stored session, which used to surface as a `TypeError`, is now deleted and reported as a `TokenInvalidError`.
