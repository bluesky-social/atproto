---
'@atproto/lex-rpc': minor
'@atproto/lex-client': patch
---

Allow the per-request `headers` option to be a (sync or async) function, called for every attempt (retries included). The client-wide `headers` (`ClientOptions`) still only accept a `HeadersInit`.

**Breaking**: `buildXrpcRequestHeaders()` is now async (returns a `Promise<Headers>`), and code reading the `headers` of `XrpcRequestHeadersOptions` (thus of `XrpcOptions`) must handle a function.
