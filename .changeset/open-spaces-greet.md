---
"@atproto/space": minor
"@atproto/pds": minor
"@atproto/api": patch
---

Allow public access to spaces: `com.atproto.space.getSpaceCredential` no longer requires a delegation token, and a simplespace with a `public` read policy issues a credential without one. Without a delegation token, any other space (including a deleted one) answers `SpaceNotFound`, so its existence isn't disclosed. A credential request without a delegation token signs the empty component list `()`. Space HTTP message signatures now require a `tag` parameter: `atproto-space-credential-request` on credential requests and `atproto-space-credential` on requests authorized by a space credential. `verifySpaceSignature` is replaced by `verifyCredentialRequestSig` and `verifyCredentialSig`. The PDS no longer rejects requests that repeat the `authorization` or `atproto-space-audience` field: the values it acts on are always the ones the signature covers.
