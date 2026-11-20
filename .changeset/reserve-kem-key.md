---
'@atproto/api': patch
'@atproto/pds': patch
---

Add `com.atproto.server.reserveKemKey`, the KEM counterpart to `reserveSigningKey`, so an entryway can publish an account's `#atproto_kem` key in its genesis PLC operation. Behind an entryway, `createAccount` uses the reserved KEM key when the operation includes one, and rejects an operation whose KEM key was not reserved.
