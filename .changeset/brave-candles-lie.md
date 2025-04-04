---
"@atproto/oauth-provider": minor
---

OAuthProvider will now always generate JWT access tokens. This will prevent "leaked" `tokenId` values from being used as access tokens directly. This change also introduces an `AccessTokenMode` that allows generating "stateless" tokens (when the AS and RS are different servers), or shorter "light" tokens (that only act as wrapper around `tokenId` values).
