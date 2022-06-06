[@adx/did-sdk](README.md) / Exports

# @adx/did-sdk

## Table of contents

### Namespaces

- [ion](modules/ion.md)
- [key](modules/key.md)
- [web](modules/web.md)

### Classes

- [DidDocAPI](classes/DidDocAPI.md)
- [DidWebServer](classes/DidWebServer.md)
- [ReadOnlyDidDocAPI](classes/ReadOnlyDidDocAPI.md)

### Type Aliases

- [DIDDocument](modules.md#diddocument)
- [KeyCapabilitySection](modules.md#keycapabilitysection)

### Functions

- [createDidWebServer](modules.md#createdidwebserver)
- [resolve](modules.md#resolve)

## Type Aliases

### DIDDocument

Ƭ **DIDDocument**: { `@context?`: ``"https://www.w3.org/ns/did/v1"`` \| `string` \| `string`[] ; `alsoKnownAs?`: `string`[] ; `controller?`: `string` \| `string`[] ; `id`: `string` ; `publicKey?`: `VerificationMethod`[] ; `service?`: `ServiceEndpoint`[] ; `verificationMethod?`: `VerificationMethod`[]  } & { [x in KeyCapabilitySection]?: (string \| VerificationMethod)[] }

#### Defined in

node_modules/did-resolver/lib/resolver.d.ts:26

___

### KeyCapabilitySection

Ƭ **KeyCapabilitySection**: ``"authentication"`` \| ``"assertionMethod"`` \| ``"keyAgreement"`` \| ``"capabilityInvocation"`` \| ``"capabilityDelegation"``

#### Defined in

node_modules/did-resolver/lib/resolver.d.ts:25

## Functions

### createDidWebServer

▸ **createDidWebServer**(`port?`): `Promise`<[`DidWebServer`](classes/DidWebServer.md)\>

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `port` | `number` | `9999` |

#### Returns

`Promise`<[`DidWebServer`](classes/DidWebServer.md)\>

#### Defined in

[src/index.ts:21](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/index.ts#L21)

___

### resolve

▸ **resolve**(`didUri`): `Promise`<[`ReadOnlyDidDocAPI`](classes/ReadOnlyDidDocAPI.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `didUri` | `string` |

#### Returns

`Promise`<[`ReadOnlyDidDocAPI`](classes/ReadOnlyDidDocAPI.md)\>

#### Defined in

[src/index.ts:7](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/index.ts#L7)
