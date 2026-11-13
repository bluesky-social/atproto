---
'@atproto/oauth-provider': patch
---

Support `space:` scopes in authorization requests.

- The consent screen receives the declarations of the requested space types, resolved as lexicons, and the verified handles of the space authorities the scopes name. A space type that cannot be resolved fails the request with `invalid_scope`; an authority whose handle cannot be verified is shown by its DID.
- When a token is issued or refreshed, a bare `space:<spaceType>` grant is expanded to the collections its declaration lists, and an `authority` of `self` is resolved to the user's DID.
