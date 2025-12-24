---
'@atproto/api': patch
---

The `CredentialSession.resumeSession()` method now leverages full session data to restore user sessions in a single HTTP call (instead of up to three before). Servers that do not return `email` and `emailConfirmed` session fields will still be supported, but will cause an additional request to `com.atproto.server.getSession` to fetch the missing data.
