---
'@atproto/lex-password-session': patch
---

Use a fetch that can open WebSockets by default, so that a `PasswordSession` can open XRPC subscriptions, with its credentials.
