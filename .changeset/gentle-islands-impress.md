---
"@atproto/oauth-provider": patch
---

Add the following hooks in the `OAuthProvider`:

- `onAuthorized` which is triggered when the user "authorized" a client (a `code` is issued)
- `onTokenCreated` which is triggered when the code is exchanged for a token
- `onTokenRefreshed` which is triggered when a refresh token is exchanged for a new access token
