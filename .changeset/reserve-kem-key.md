---
'@atproto/api': patch
'@atproto/pds': patch
---

Add `com.atproto.server.reserveKemKey`, the KEM counterpart to `reserveSigningKey`, so an entryway can publish an account's `#atproto_kem` key in its genesis PLC operation. Behind an entryway, `createAccount` now requires the operation to include a KEM key reserved on the PDS.
