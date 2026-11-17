---
'@atproto/oauth-provider-ui': patch
'@atproto/oauth-provider': patch
'@atproto/oauth-scopes': patch
---

Rate space access on the consent screen by how far it reaches: spaces of one named authority are informational (an authority whose handle could not be verified shows as `handle.invalid`), spaces of any authority or owned by the user warn, and every space on the network warns loudly and must be acknowledged before authorizing. Space authorities named by `include:` permission sets are now resolved to handles too. Each `manage` operation granted (create, update, delete spaces) is described on its own. As at token issuance, only a bare `space:<type>` grant requires the space type's declaration to resolve: one that names its collections no longer fails the authorization request without it. Add `listSpacePermissions` to `@atproto/oauth-scopes`, which lists the space permissions of a scope, including those carried by `include:` permission sets.
