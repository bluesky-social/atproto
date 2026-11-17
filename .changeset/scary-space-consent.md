---
'@atproto/oauth-provider-ui': patch
'@atproto/oauth-provider': patch
---

Rate space access on the consent screen by how far it reaches: spaces run by the client's own hostname read as routine, spaces run by one named authority as informational, spaces of any authority or owned by the user warn, and every space on the network warns loudly and must be acknowledged before authorizing. Space authorities named by `include:` permission sets are now resolved to handles too.
