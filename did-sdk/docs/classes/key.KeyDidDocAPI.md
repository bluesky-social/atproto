[@adx/did-sdk](../README.md) / [Exports](../modules.md) / [key](../modules/key.md) / KeyDidDocAPI

# Class: KeyDidDocAPI

[key](../modules/key.md).KeyDidDocAPI

## Hierarchy

- `WritableDidDocAPI`

  ↳ **`KeyDidDocAPI`**

## Table of contents

### Constructors

- [constructor](key.KeyDidDocAPI.md#constructor)

### Properties

- [\_didDoc](key.KeyDidDocAPI.md#_diddoc)
- [id](key.KeyDidDocAPI.md#id)
- [keys](key.KeyDidDocAPI.md#keys)

### Accessors

- [didDoc](key.KeyDidDocAPI.md#diddoc)

### Methods

- [create](key.KeyDidDocAPI.md#create)
- [getController](key.KeyDidDocAPI.md#getcontroller)
- [getPublicKey](key.KeyDidDocAPI.md#getpublickey)
- [getService](key.KeyDidDocAPI.md#getservice)
- [getURI](key.KeyDidDocAPI.md#geturi)
- [hydrate](key.KeyDidDocAPI.md#hydrate)
- [listPublicKeys](key.KeyDidDocAPI.md#listpublickeys)
- [listServices](key.KeyDidDocAPI.md#listservices)
- [serialize](key.KeyDidDocAPI.md#serialize)

## Constructors

### constructor

• **new KeyDidDocAPI**()

#### Overrides

WritableDidDocAPI.constructor

#### Defined in

[src/key/key.ts:55](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L55)

## Properties

### \_didDoc

• **\_didDoc**: `undefined` \| [`DIDDocument`](../modules.md#diddocument)

#### Defined in

[src/key/key.ts:53](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L53)

___

### id

• **id**: `string` = `''`

#### Defined in

[src/key/key.ts:51](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L51)

___

### keys

• **keys**: `DidKey`[] = `[]`

#### Defined in

[src/key/key.ts:52](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L52)

## Accessors

### didDoc

• `get` **didDoc**(): [`DIDDocument`](../modules.md#diddocument)

#### Returns

[`DIDDocument`](../modules.md#diddocument)

#### Overrides

WritableDidDocAPI.didDoc

#### Defined in

[src/key/key.ts:59](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L59)

## Methods

### create

▸ **create**(`type`, `generateOptions?`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | [`KeyType`](../modules/key.md#keytype) |
| `generateOptions?` | [`generateFromSeedOptions`](../modules/key.md#generatefromseedoptions) \| [`generateFromRandomOptions`](../modules/key.md#generatefromrandomoptions) |

#### Returns

`Promise`<`void`\>

#### Defined in

[src/key/key.ts:66](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L66)

___

### getController

▸ **getController**(): `string`

#### Returns

`string`

#### Inherited from

WritableDidDocAPI.getController

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

WritableDidDocAPI.getPublicKey

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

WritableDidDocAPI.getService

#### Defined in

[src/did-documents.ts:50](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L50)

___

### getURI

▸ **getURI**(): `string`

#### Returns

`string`

#### Inherited from

WritableDidDocAPI.getURI

#### Defined in

[src/did-documents.ts:14](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L14)

___

### hydrate

▸ **hydrate**(`state`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `state` | [`DidKeySerializedState`](../modules/key.md#didkeyserializedstate) |

#### Returns

`Promise`<`void`\>

#### Overrides

WritableDidDocAPI.hydrate

#### Defined in

[src/key/key.ts:92](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L92)

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

WritableDidDocAPI.listPublicKeys

#### Defined in

[src/did-documents.ts:28](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L28)

___

### listServices

▸ **listServices**(): `ServiceEndpoint`[]

#### Returns

`ServiceEndpoint`[]

#### Inherited from

WritableDidDocAPI.listServices

#### Defined in

[src/did-documents.ts:46](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/did-documents.ts#L46)

___

### serialize

▸ **serialize**(): [`DidKeySerializedState`](../modules/key.md#didkeyserializedstate)

#### Returns

[`DidKeySerializedState`](../modules/key.md#didkeyserializedstate)

#### Overrides

WritableDidDocAPI.serialize

#### Defined in

[src/key/key.ts:85](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L85)
