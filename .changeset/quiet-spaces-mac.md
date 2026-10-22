---
"@atproto/crypto": patch
"@atproto/space": minor
"@atproto/pds": minor
"@atproto/api": minor
---

Authenticate space repo commits and records with a MAC instead of a signature. Commits (`com.atproto.space.defs#commit`) no longer carry a signature; instead the syncer and repo host derive a per-request shared secret by ECDH against the account's new `#atproto_kem` P-256 key, and the host returns an HMAC in the `Atproto-Space-Mac` response header when asked with `Atproto-Space-Want-Mac`. Rename the commit digest `hash` to `data` in commits, `notifyWrite`, and `listRepos`. `verifyRecord` checks a `getRecord` response against its MAC and CID.

The PDS recommends the account's `#atproto_kem` key from `getRecommendedDidCredentials`, requires it in `submitPlcOperation`, republishes it from the `rotate-keys` script, and exposes `Atproto-Space-Mac` to browsers through `Access-Control-Expose-Headers`.

Add `P256Keypair.ecdh()`, and make `hkdfSha256` a full extract-and-expand HKDF. Serialize the space request `Signature` header as padded base64, per RFC 9651.
