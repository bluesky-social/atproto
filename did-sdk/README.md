# @adx/did-sdk

An SDK for working with DIDs in ADX. Supports did:key, did:web, and did:ion.

```typescript
import crypto from 'crypto'
import * as didSdk from '@adx/did-sdk'

// resolve a did
const did = await didSdk.resolve('did:web:example.com')
console.log(did.getURI()) // => 'did:web:example.com'
console.log(did.getController()) // => string
console.log(did.listPublicKeys()) // => VerificationMethod[]
console.log(did.getPublicKey('assertionMethod')) // => VerificationMethod
console.log(did.listServices()) // => ServiceEndpoint[]
console.log(did.getService('SomeService')) // => ServiceEndpoint

// create a did
const didKey = await didSdk.key.create('ed25519')
const didIon = await didSdk.ion.create(
  {
    services: [{
      id: Buffer.from('#service1', 'utf8').toString('base64'),
      type: 'SomeService',
      serviceEndpoint: 'https://example.com'
    }]
  }
)

// save / restore a did
const serializableState = didKey.serialize()
const state = JSON.stringify(didKey.serialize(), null, 2)
// ...write to some storage...
const didKey2 = await didSdk.key.inst(JSON.parse(state))

// run a simple did:web server
const server = await didSdk.createDidWebServer(12345)
server.put({/* ... did doc ... */})
```

## [Docs](./docs/modules.md)

You can [find the generated docs here](./docs/modules.md).