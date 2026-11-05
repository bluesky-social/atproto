---
'@atproto/oauth-provider': minor
'@atproto/pds': patch
---

Only accept pushed authorization requests on the authorization endpoint (RFC 9126 §4), as advertised by `require_pushed_authorization_requests`

**Breaking changes**:

- `/oauth/authorize` only accepts a `request_uri` obtained from the PAR endpoint. Authorization requests passed by value, as plain parameters or as a request object (`request=`), are refused with `invalid_request`. Clients that skip PAR must push their authorization requests first (request objects remain supported through PAR).
- `OAuthProvider.authorize()` only accepts PAR queries (`client_id` and `request_uri`).
