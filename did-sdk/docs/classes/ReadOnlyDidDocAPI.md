[@adx/did-sdk](../README.md) / [Exports](../modules.md) / ReadOnlyDidDocAPI

# Class: ReadOnlyDidDocAPI

## Hierarchy

- [`DidDocAPI`](DidDocAPI.md)

  ↳ **`ReadOnlyDidDocAPI`**

## Table of contents

### Constructors

- [constructor](ReadOnlyDidDocAPI.md#constructor)

### Properties

- [didDocMetadata](ReadOnlyDidDocAPI.md#diddocmetadata)

### Accessors

- [didDoc](ReadOnlyDidDocAPI.md#diddoc)

### Methods

- [getController](ReadOnlyDidDocAPI.md#getcontroller)
- [getPublicKey](ReadOnlyDidDocAPI.md#getpublickey)
- [getService](ReadOnlyDidDocAPI.md#getservice)
- [getURI](ReadOnlyDidDocAPI.md#geturi)
- [listPublicKeys](ReadOnlyDidDocAPI.md#listpublickeys)
- [listServices](ReadOnlyDidDocAPI.md#listservices)

## Constructors

### constructor

• **new ReadOnlyDidDocAPI**(`_didDoc`, `didDocMetadata?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `_didDoc` | [`DIDDocument`](../modules.md#diddocument) |
| `didDocMetadata?` | `DIDDocumentMetadata` |

#### Overrides

[DidDocAPI](DidDocAPI.md).[constructor](DidDocAPI.md#constructor)

#### Defined in

[src/did-documents.ts:70](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L70)

## Properties

### didDocMetadata

• `Optional` **didDocMetadata**: `DIDDocumentMetadata`

## Accessors

### didDoc

• `get` **didDoc**(): [`DIDDocument`](../modules.md#diddocument)

#### Returns

[`DIDDocument`](../modules.md#diddocument)

#### Overrides

DidDocAPI.didDoc

#### Defined in

[src/did-documents.ts:77](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L77)

## Methods

### getController

▸ **getController**(): `string`

#### Returns

`string`

#### Inherited from

[DidDocAPI](DidDocAPI.md).[getController](DidDocAPI.md#getcontroller)

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

#### Inherited from

[DidDocAPI](DidDocAPI.md).[getPublicKey](DidDocAPI.md#getpublickey)

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

#### Inherited from

[DidDocAPI](DidDocAPI.md).[getService](DidDocAPI.md#getservice)

#### Defined in

[src/did-documents.ts:50](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L50)

___

### getURI

▸ **getURI**(): `string`

#### Returns

`string`

#### Inherited from

[DidDocAPI](DidDocAPI.md).[getURI](DidDocAPI.md#geturi)

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

#### Inherited from

[DidDocAPI](DidDocAPI.md).[listPublicKeys](DidDocAPI.md#listpublickeys)

#### Defined in

[src/did-documents.ts:28](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L28)

___

### listServices

▸ **listServices**(): `ServiceEndpoint`[]

#### Returns

`ServiceEndpoint`[]

#### Inherited from

[DidDocAPI](DidDocAPI.md).[listServices](DidDocAPI.md#listservices)

#### Defined in

[src/did-documents.ts:46](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L46)
