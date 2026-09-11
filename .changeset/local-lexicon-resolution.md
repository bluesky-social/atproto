---
'@atproto/pds': patch
'@atproto/oauth-provider': patch
---

Resolve permission set lexicons hosted on the PDS itself from the local actor store instead of fetching them over the network. Re-export `LexResolverError` from `@atproto/oauth-provider`.
