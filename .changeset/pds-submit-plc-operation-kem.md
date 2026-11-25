---
'@atproto/pds': minor
---

**Breaking**: `com.atproto.identity.submitPlcOperation` rejects an operation that names a different `atproto_kem` key than the account's, or that omits it once `PDS_SPACES_MIGRATION` is `complete`. Before then, it may omit the key unless that would remove the account's published key.
