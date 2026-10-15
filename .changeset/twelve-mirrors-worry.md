---
"@atproto/lex-client": minor
"@atproto/lex-installer": minor
"@atproto/lex-password-session": minor
"@atproto/lex-resolver": minor
"@atproto/lex-server": minor
---

Refactor around a new, lower-level, `@atproto/lex-rpc` package for making XRPC requests. `@atproto/lex-client` re-exports everything from `@atproto/lex-rpc`, allowing it to stay backwards compatible, and contains logic related to making XRPC requests in the context of manipulating an AT Protocol repository with an authenticated session. This refactor also allows `@atproto/lex-client` to depend on `@atproto/lex-installer`, while also allowing `@atproto/lex-installer` to make XRPC requests (using the lower level `@atproto/lex-rpc`).
