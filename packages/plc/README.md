# DID Placeholder (did:plc)

DID Placeholder is a cryptographic, strongly-consistent, and recoverable [DID](https://www.w3.org/TR/did-core/) method.

## Motivation

We introduced DID Placeholder because we weren't totally satisfied with any of the existing DID methods. 
We wanted a strongly consistent, highly available, recoverable, and cryptographically secure method with cheap and fast propagation of updates.

We cheekily titled the method "Placeholder", because we _don't_ want it to stick around. We're actively hoping to replace it with something less centralized. 
We expect a method to emerge that fits the bill within the next few years, likely a permissioned DID consortium. 

## How it works
This is not a fully-expressive DID format.
Though it adheres to the DID spec, it is domain-specific and only allows for representing specific data types in a specific manner.
There is the possibility that it could be extended to be more general in the future.

Each DID document is made up of just four pieces of data (for now): 
- `signingKey`
- `recoveryKey`
- `username`
- `atpPds` (Personal Data Server for the related AT Protocol repository)

DID documents are derived from a log of signed operations, ordered by the PLC server.

There are 5 operations that can be found in each log: `create`, `rotate_signing_key`, `rotate_recovery_key`, `update_username`, and `update_atp_pds`.

Each operation is of the shape:
```ts
type Operation = {
  type: string // operation type
  prev: CID | null // pointer to the CID of the previous operation in the log
  sig: string // base64url encoded signature of the operation
  ... // other operation-specific data
}
```

Each operation contains a reference the the immediately preceding operation in the log and is signed by either the `signingKey` or the `recoveryKey`.

The DID itself is derived from the sha256 hash of the first operation in the log.
It is then base32 encoded and truncated to 24 chars.

To illustrate: 
`did:plc:${base32Encode(sha256(createOp)).slice(0,24)}`

Operations are verified, ordered and made availble by the PLC server. 

The PLC server is contrained in it's capabilities.
The operation logs are fully self-certifying, with the exception of their ordering.

Therefore, the PLC server's attacks are limited to:
- Denial of service: rejecting valid operations, or refusing to serve some information about the DID
- Misordering: In the event of a fork in DID document history, the server could choose to serve the "wrong" fork

### Signing and Recovery Keys

Both the `signingKey` and the `recoveryKey` are permissioned to make changes to the DID document.
However, these keys are not equal.

As can be seen in the example document (below), only the `signingKey` is granted the ability to make assertions and invoke/delegate capabilities.

The recovery key on the other hand is capable of performing a "recovery operation"

### Account Recovery

The PLC server provides a 72hr window during which the `recoveryKey` can "rewrite" history.

This is to be used in adversarial situations in which a user's `signingKey` leaks or is being held by some custodian who turns out to be a bad actor.

In a situation such as this, the `signingKey` may be used to rotate both the `signingKey` and `recoveryKey`.

If a user wishes to recovery from this situation, they sign a new operation rotating the `signingKey` to a key that they hold and set the `prev` of that operation to point to the most recent pre-attack operation.

## Example

Consider the following operation log:
```ts
[
  {
    type: 'create',
    signingKey: 'did:key:zDnaejYFhgFiVF89LhJ4UipACLKuqo6PteZf8eKDVKeExXUPk',
    recoveryKey: 'did:key:zDnaeSezF2TgCD71b5DiiFyhHQwKAfsBVqTTHRMvP597Z5Ztn',
    username: 'alice.example.com',
    service: 'https://example.com',
    prev: null,
    sig: 'vi6JAl5W4FfyViD5_BKL9p0rbI3MxTWuh0g_egTFAjtf7gwoSfSe1O3qMOEUPX6QH3H0Q9M4y7gOLGblWkEwfQ'
  },
  {
    type: 'update_username',
    username: 'ali.example2.com',
    prev: 'bafyreih2gihqzgq5qd6uqktyfpyxqxvpdnrpu2qunnkaxugbyquxumisuq',
    sig: 'KL98ORpGmAJTqDsC9mWAYbhoDIv_-eZ3Nv0YqiPkbgx0ra96gYa3fQhIpZVxXFyNbu_4Y3JhPCvyJb8yDMe9Sg'
  },
  {
    type: 'update_atp_pds',
    service: 'https://example2.com',
    prev: 'bafyreickw7v7mwncrganw645agsmwjciolknt4f6f5an5wt3nrjepqaoiu',
    sig: 'AS-APea3xxR5-sq2i5v9IOsgbM5G5qAnB92tExZ8Z4vEy_GQbV8jmfY7zTx76P88AVXInZsO6yWX4UO7_xAIfg'
  },
  {
    type: 'rotate_signing_key',
    key: 'did:key:zDnaeh9v2RmcMo13Du2d6pjUf5bZwtauYxj3n9dYjw4EZUAR7',
    prev: 'bafyreictfsrkdt5azni355vapqka5a7erqjsa3vv7iaf52yjlqqbzkwgga',
    sig: 'VvcCoYVDluLZghv3i6ARyk1r7m1M32BPryJlTma1HTOx2CdbmIOUkVUbFa2LWi571fe-2yjTWY0IEAKfRiPAZg'
  },
  {
    type: 'rotate_recovery_key',
    key: 'did:key:zDnaedvvAsDE6H3BDdBejpx9ve2Tz95cymyCAKF66JbyMh1Lt',
    prev: 'bafyreiazzldal6642usrcowrpztb5gjb73qla343ifnt5dfbxz4swmf5vi',
    sig: 'Um1GVZZT9JgB2SKEbwoF4_Sip05QjH7r_g-Hcx7lIY-OhIg88ZKcN_N4TgzljgBGwe6qZb0u_0Vaq0c-S2WSDg'
  }
]
```

The log produces the following document data:
```ts
{
  did: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
  signingKey: 'did:key:zDnaeh9v2RmcMo13Du2d6pjUf5bZwtauYxj3n9dYjw4EZUAR7',
  recoveryKey: 'did:key:zDnaedvvAsDE6H3BDdBejpx9ve2Tz95cymyCAKF66JbyMh1Lt',
  username: 'ali.example2.com',
  atpPds: 'https://example2.com'
}
```

And the following DID document:
```ts
{
  '@context': [
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/suites/ecdsa-2019/v1'
  ],
  id: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
  alsoKnownAs: [ 'https://ali.example2.com' ],
  verificationMethod: [
    {
      id: 'did:plc:7iza6de2dwap2sbkpav7c6c6#signingKey',
      type: 'EcdsaSecp256r1VerificationKey2019',
      controller: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
      publicKeyMultibase: 'zSSa7w8s5aApu6td45gWTAAFkqCnaWY6ZsJ8DpyzDdYmVy4fARKqbn5F1UYBUMeVvYTBsoSoLvZnPdjd3pVHbmAHP'
    },
    {
      id: 'did:plc:7iza6de2dwap2sbkpav7c6c6#recoveryKey',
      type: 'EcdsaSecp256r1VerificationKey2019',
      controller: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
      publicKeyMultibase: 'zRV2EDDvop2r2aKWTcCtei3NvuNEnR5ucTVd9U4CSCnJEiha2QFyTjdxoFZ6629iHxhmTModThGQzX1495ZS6iD4V'
    }
  ],
  assertionMethod: [ 'did:plc:7iza6de2dwap2sbkpav7c6c6#signingKey' ],
  capabilityInvocation: [ 'did:plc:7iza6de2dwap2sbkpav7c6c6#signingKey' ],
  capabilityDelegation: [ 'did:plc:7iza6de2dwap2sbkpav7c6c6#signingKey' ],
  service: [
    {
      id: 'did:plc:7iza6de2dwap2sbkpav7c6c6#atpPds',
      type: 'AtpPersonalDataServer',
      serviceEndpoint: 'https://example2.com'
    }
  ]
}
```