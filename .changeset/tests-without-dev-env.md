---
'@atproto-labs/fetch-node': patch
'@atproto-labs/opentelemetry-node': patch
'@atproto/api': patch
'@atproto/aws': patch
'@atproto/bsky': patch
'@atproto/bsync': patch
'@atproto/common': patch
'@atproto/dev-env': patch
'@atproto/identity': patch
'@atproto/lex-client': patch
'@atproto/lex-password-session': patch
'@atproto/lex-rpc': patch
'@atproto/lexicon-resolver': patch
'@atproto/oauth-provider': patch
'@atproto/ozone': patch
'@atproto/pds': patch
'@atproto/sync': patch
'@atproto/syntax': patch
'@atproto/ws-client': patch
'@atproto/xrpc-server': patch
---

Restructure tests: colocate unit tests with the code they test, run `@atproto/api` and `@atproto/lexicon-resolver` tests against in-process stubs instead of `@atproto/dev-env`, and make server and socket waits in tests reject instead of hanging
