---
"@atproto/oauth-provider": patch
"@atproto/oauth-types": patch
---

Implement authorization_management_uri for discovery of Authorization Server account page

This implements the following internet draft for exposing an `authorization_management_uri` from the Authorization Server Metadata response. This allows client applications to provide a link to the management UI on the Authorization Server to manage their OAuth clients, sessions and account credentials.

https://datatracker.ietf.org/doc/draft-emelia-oauth-authorization-management-uri/
