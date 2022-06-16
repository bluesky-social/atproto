[@adx/did-sdk](../README.md) / [Exports](../modules.md) / DidDocAPI

# Class: DidDocAPI

## Hierarchy

- **`DidDocAPI`**

  ↳ [`ReadOnlyDidDocAPI`](ReadOnlyDidDocAPI.md)

## Table of contents

### Constructors

- [constructor](DidDocAPI.md#constructor)

### Accessors

- [didDoc](DidDocAPI.md#diddoc)

### Methods

- [getController](DidDocAPI.md#getcontroller)
- [getPublicKey](DidDocAPI.md#getpublickey)
- [getService](DidDocAPI.md#getservice)
- [getURI](DidDocAPI.md#geturi)
- [listPublicKeys](DidDocAPI.md#listpublickeys)
- [listServices](DidDocAPI.md#listservices)

## Constructors

### constructor

• **new DidDocAPI**()

## Accessors

### didDoc

• `get` **didDoc**(): [`DIDDocument`](../modules.md#diddocument)

#### Returns

[`DIDDocument`](../modules.md#diddocument)

#### Defined in

[src/did-documents.ts:10](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L10)

## Methods

### getController

▸ **getController**(): `string`

#### Returns

`string`

#### Defined in

[src/did-documents.ts:18](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L18)

___

### getPublicKey

▸ **getPublicKey**(`purpose`, `offset?`): `VerificationMethod`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `purpose` | [`KeyCapabilitySection`](../modules.md#keycapabilitysection) | `undefined` |
| `offset` | `number` | `0` |

#### Returns

`VerificationMethod`

#### Defined in

[src/did-documents.ts:37](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L37)

___

### getService

▸ **getService**(`type`): `ServiceEndpoint`

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |

#### Returns

`ServiceEndpoint`

#### Defined in

[src/did-documents.ts:50](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L50)

___

### getURI

▸ **getURI**(): `string`

#### Returns

`string`

#### Defined in

[src/did-documents.ts:14](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L14)

___

### listPublicKeys

▸ **listPublicKeys**(`purpose`): `VerificationMethod`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `purpose` | [`KeyCapabilitySection`](../modules.md#keycapabilitysection) |

#### Returns

`VerificationMethod`[]

#### Defined in

[src/did-documents.ts:28](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L28)

___

### listServices

▸ **listServices**(): `ServiceEndpoint`[]

#### Returns

`ServiceEndpoint`[]

#### Defined in

[src/did-documents.ts:46](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L46)
