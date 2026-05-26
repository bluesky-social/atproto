# @atproto/crypto — Key + signature primitives

Low-level crypto for atproto: signing keys (secp256k1, P-256), DID-formatted public keys (`did:key`), and signature verification. No business logic — just primitives.

## Used by

- `@atproto/repo` — commit signing
- `@atproto/identity` — verifying DID document signing keys
- `@atproto/pds` — account keys, service-auth tokens
- `@atproto/oauth-provider` — JWT signing

## When to touch

- Practically never. Crypto bugs are silent and dangerous. If a change is needed, write extensive tests and have it reviewed by someone who's done crypto before.
