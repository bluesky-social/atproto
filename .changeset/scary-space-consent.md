---
'@atproto/oauth-provider-ui': patch
'@atproto/oauth-provider': patch
'@atproto/oauth-scopes': patch
---

Rate space access on the consent screen by how far it reaches: spaces run by the client's own hostname read as routine, spaces run by one named authority as informational, spaces of any authority, owned by the user, or run by an authority whose handle could not be verified warn, and every space on the network warns loudly and must be acknowledged before authorizing. Space authorities named by `include:` permission sets are now resolved to handles too. Add `listSpacePermissions` to `@atproto/oauth-scopes`, which lists the space permissions of a scope, including those carried by `include:` permission sets.
