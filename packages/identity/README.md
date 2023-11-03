# @atproto/identity

TypeScript library for decentralized identities in [atproto](https://atproto.com) using DIDs and handles

[![NPM](https://img.shields.io/npm/v/@atproto/identity)](https://www.npmjs.com/package/@atproto/identity)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Example

Resolving a Handle and verifying against DID document:

```typescript
const didres = new DidResolver({})
const hdlres = new HandleResolver({})

const handle = 'atproto.com'
const did = await hdlres.resolve(handle)

if (did == undefined) {
  throw new Error('expected handle to resolve')
}
console.log(did) // did:plc:ewvi7nxzyoun6zhxrhs64oiz

const doc = await didres.resolve(did)
console.log(doc)

// additional resolutions of same DID will be cached for some time, unless forceRefresh flag is used
const doc2 = await didres.resolve(did, true)

// helper methods use the same cache
const data = await didres.resolveAtprotoData(did)

if (data.handle != handle) {
  throw new Error('invalid handle (did not match DID document)')
}
```

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
