---
'@atproto/lex-rpc': patch
'@atproto/lex-client': patch
'@atproto/lex': patch
---

Add a `redirect` option to XRPC requests and to the `Client` constructor, setting the redirect mode passed to `fetch()` (still `"follow"` by default).
