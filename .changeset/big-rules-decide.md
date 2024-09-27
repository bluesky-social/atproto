---
"@atproto/oauth-provider": patch
---

Disable request params scopes defaulting to client metadata scopes. Requires that client always provide a "scope" parameter when initiating an oauth flow.
