---
"@atproto/pds": patch
---

Allow an entryway to migrate an existing did:plc or did:web account into a PDS by calling `com.atproto.server.createAccount` with its service JWT and no `plcOp`. `com.atproto.identity.getRecommendedDidCredentials` no longer returns `rotationKeys` for non-PLC DIDs.
