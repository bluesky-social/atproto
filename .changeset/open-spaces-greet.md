---
"@atproto/space": minor
"@atproto/pds": minor
"@atproto/api": patch
---

Allow public access to spaces: `com.atproto.space.getSpaceCredential` no longer requires a delegation token, and a simplespace with a `public` read policy issues a credential without one. Without a delegation token, any other space (including a deleted one) answers `SpaceNotFound`, so its existence isn't disclosed.

`getSpaceCredential` is no longer authenticated by an HTTP message signature: the key to bind (`credentialKid`), the delegation token (`delegationToken`), and the client attestation are all passed in the request body. A bad delegation token is refused with `InvalidDelegationToken`.

Space credentials are presented with the `Atproto-Space-Credential` authorization scheme (recognized regardless of case), signed under the `atproto-space-credential` signature label with a `tag` of `atproto-space-credential`. `verifySpaceSignature` is replaced by `verifyCredentialSig`, and `isP256DidKey` is exported.
