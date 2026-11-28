---
'@atproto/api': patch
'@atproto/common-web': patch
'@atproto/crypto': patch
'@atproto/did': patch
'@atproto/identity': patch
'@atproto/lexicon': patch
'@atproto/repo': patch
'@atproto/xrpc-server': patch
---

Run the test suite with vitest instead of jest. `@atproto/api` no longer ships its compiled `age-assurance` test file in `dist`.
