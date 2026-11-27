---
'@atproto/oauth-provider': patch
---

Provide the permissions granted by a new token to the `onTokenCreated` hook through its `scope` field. This includes permissions granted through `include:` permission sets.
