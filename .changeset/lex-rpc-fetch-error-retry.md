---
'@atproto/lex-rpc': patch
---

`XrpcFetchError` is no longer retryable when Node.js' `fetch()` reports a failure that a retry cannot fix, such as a refused redirect (`redirect: "error"`), too many redirects, an unknown host or an invalid TLS certificate.
