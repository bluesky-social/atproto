---
"@atproto/bsky": patch
"@atproto/dev-env": patch
"@atproto/lexicon-resolver": patch
"@atproto/ozone": patch
"@atproto/pds": patch
"@atproto/sync": patch
"@atproto/tap": patch
---

Depend on the `@atproto/lex-*` packages that `@atproto/lex` re-exports instead of `@atproto/lex`, which also installs the lexicon codegen tooling
