---
"@atproto/lex-cli": patch
---

Speed up `gen-api` and `gen-server` (about 15× on the `@atproto/api` lexicons) by building each generated file from ts-morph structures instead of node-by-node manipulations. The generated code is unchanged.
