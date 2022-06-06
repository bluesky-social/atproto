@adx/did-sdk / [Exports](modules.md)

# @adx/did-sdk

An SDK for working with DIDs in ADX. Supports did:key, did:web, and did:ion.

```typescript
import crypto from 'crypto
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
const didKey = await did.key.create('ed25519', {
  secureRandom: () => crypto.randomBytes(32)
})
const didIon = await ion.create(
  {
    services: [{
      id: Buffer.from('#service1', 'utf8').toString('base64'),
      type: 'SomeService',
      serviceEndpoint: 'https://example.com'
    }]
  },
  {
    keyType: 'secp256k1',
    secureRandom: () => crypto.randomBytes(32),
  }
)

// run a simple did:web server
const server = await didSdk.createDidWebServer(12345)
server.put({/* ... did doc ... */})
```

## [Docs](./docs)

You can [find the generated docs here](./docs).
