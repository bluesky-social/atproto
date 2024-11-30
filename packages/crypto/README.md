# @atproto/crypto

TypeScript library providing basic cryptographic helpers as needed in [atproto](https://atproto.com).

[![NPM](https://img.shields.io/npm/v/@atproto/crypto)](https://www.npmjs.com/package/@atproto/crypto)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

This package implements the two currently supported cryptographic systems:

- P-256 elliptic curve: aka "NIST P-256", aka secp256r1 (note the r), aka prime256v1
- K-256 elliptic curve: aka "NIST K-256", aka secp256k1 (note the k)

The details of cryptography in atproto are described in [the specification](https://atproto.com/specs/cryptography). This includes string encodings, validity of "low-S" signatures, byte representation "compression", hashing, and more.

## Usage

```typescript
import { verifySignature, Secp256k1Keypair, P256Keypair } from '@atproto/crypto'

// generate a new random K-256 private key
const keypair = await Secp256k1Keypair.create({ exportable: true })

// sign binary data, resulting signature bytes.
// SHA-256 hash of data is what actually gets signed.
// signature output is often base64-encoded.
const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
const sig = await keypair.sign(data)

// serialize the public key as a did:key string, which includes key type metadata
const pubDidKey = keypair.did()
console.log(pubDidKey)

// output would look something like: 'did:key:zQ3shVRtgqTRHC7Lj4DYScoDgReNpsDp3HBnuKBKt1FSXKQ38'

// verify signature using public key
const ok = verifySignature(pubDidKey, data, sig)
if (!ok) {
  throw new Error('Uh oh, something is fishy')
} else {
  console.log('Success')
}
```

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
