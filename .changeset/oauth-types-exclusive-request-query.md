---
'@atproto/oauth-types': minor
---

Make the variants of `oauthAuthorizationRequestQuerySchema` mutually exclusive

A query carrying a `request_uri` is now always parsed as a reference to a pushed authorization request, ignoring any other authorization request parameter. It used to be parsed as a plain authorization request, silently dropping the `request_uri`, whenever it also carried a `response_type`. Queries carrying both a `request_uri` and a `request` are now rejected.

**Breaking change**: each variant of `OAuthAuthorizationRequestQuery` declares the other variants' parameters as `undefined` (`request?: undefined`, `request_uri?: undefined`), so an `in` check no longer narrows the type: check the value instead (e.g. `query.request_uri != null`).
