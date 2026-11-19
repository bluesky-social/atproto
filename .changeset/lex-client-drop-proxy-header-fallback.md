---
'@atproto/lex-client': minor
---

**Breaking:** an `atproto-proxy` header passed in a request's `headers` no longer sets that request's `service`. The client's `service` now always applies, replacing that header, or removing it when the client has none. Pass `service` in the request options instead.
