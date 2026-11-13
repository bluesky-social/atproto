---
'@atproto/repo': minor
---

**Breaking**: Reading a CAR rejects any root or block CID that is not a CIDv1 DAG-CBOR SHA-256 CID, and `readCar()` and `readCarWithRoot()` type the roots and blocks they return as `CborCid`.
