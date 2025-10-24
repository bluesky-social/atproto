---
"@atproto/oauth-types": minor
---

Remove exported `oauthHttpsRedirectURISchema` and `oauthPrivateUseRedirectURISchema` in favor of `oauthRedirectUriSchema` and `oauthLoopbackClientRedirectUriSchema`, which provide semantically meaningful groupings of redirect URIs based on OAuth client types.

`oauthHttpsRedirectURISchema` can still be accessed using `httpsUriSchema`.
`oauthPrivateUseRedirectURISchema` can still be accessed using `privateUseUriSchema`.

