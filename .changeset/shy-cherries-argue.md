---
"@atproto/oauth-client": patch
"@atproto/oauth-client-node": patch
---

Fix support for multiple redirect URIs in `@atproto/oauth-client`

Previously the callback method assumed a singular `redirect_uris` value, and enforced only performing the callback with the first registered redirect URI. This change allows passing the actual redirect URI to the `callback` method, much like the `authorize` method supports.
