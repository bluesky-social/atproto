---
'@atproto/did': patch
---

Add `extractKemKey()` to extract the `#atproto_kem` verification method (a P-256 key, as `Multikey` or `EcdsaSecp256r1VerificationKey2019`) from an atproto DID document, along with the `isAtprotoKemVerificationMethod()` guard, the `AtprotoKemVerificationMethod` type and `ATPROTO_KEM_VERIFICATION_METHOD_TYPES` (`isAtprotoKemVerificationMethodType()`).
