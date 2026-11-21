---
'@atproto/api': patch
'@atproto/pds': patch
---

Add `com.atproto.server.reserveKemKey`, the KEM counterpart to `reserveSigningKey`, so an entryway can publish an account's `#atproto_kem` key in its genesis PLC operation. Behind an entryway, `createAccount` uses the reserved KEM key when the operation includes one. Without an entryway, activating an account, e.g. to complete a migration, now requires its DID document to include the account's KEM key.
