---
'@atproto/api': patch
'@atproto/pds': patch
---

Add `com.atproto.server.reserveKemKey`, the KEM counterpart to `reserveSigningKey`, so an entryway can publish an account's `#atproto_kem` key in its genesis PLC operation. Behind an entryway, `createAccount` uses the reserved KEM key when the operation includes one. Without an entryway and once `PDS_SPACES_MIGRATION` is `complete`, activating an account with a local KEM key, e.g. to complete a migration, requires its DID document to include that key, except that `did:web` accounts may omit it.
