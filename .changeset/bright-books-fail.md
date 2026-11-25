---
'@atproto/jwk': minor
'@atproto/jwk-jose': patch
---

Add `Key#deriveJwkThumbprint(digestAlgorithm?)`, which computes the key's RFC 7638 JWK thumbprint (base64url-encoded, `sha256` by default). The method is abstract on `Key`, so custom `Key` subclasses must now implement it; `JoseKey` (and `WebcryptoKey`, which extends it) does.
