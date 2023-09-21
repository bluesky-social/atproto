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

MIT License
