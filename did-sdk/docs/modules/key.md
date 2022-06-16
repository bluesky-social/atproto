[@adx/did-sdk](../README.md) / [Exports](../modules.md) / key

# Namespace: key

## Table of contents

### Classes

- [KeyDidDocAPI](../classes/key.KeyDidDocAPI.md)

### Type Aliases

- [DidKey](key.md#didkey)
- [DidKeySerializedState](key.md#didkeyserializedstate)
- [KeyType](key.md#keytype)
- [generateFromRandomOptions](key.md#generatefromrandomoptions)
- [generateFromSeedOptions](key.md#generatefromseedoptions)

### Functions

- [create](key.md#create)
- [inst](key.md#inst)
- [resolve](key.md#resolve)

## Type Aliases

### DidKey

Ƭ **DidKey**: `Unpacked`<`GeneratedDid`[``"keys"``]\>

#### Defined in

[src/key/key.ts:20](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L20)

___

### DidKeySerializedState

Ƭ **DidKeySerializedState**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `id` | `string` |
| `keys` | [`DidKey`](key.md#didkey)[] |

#### Defined in

[src/key/key.ts:21](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L21)

___

### KeyType

Ƭ **KeyType**: ``"ed25519"`` \| ``"x25519"`` \| ``"secp256k1"`` \| ``"bls12381"`` \| ``"secp256r1"`` \| ``"secp384r1"`` \| ``"secp521r1"``

#### Defined in

[src/key/key.ts:10](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L10)

___

### generateFromRandomOptions

Ƭ **generateFromRandomOptions**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `crvOrSize` | ``"P-256"`` \| ``"P-384"`` \| ``"P-521"`` |
| `kty` | ``"EC"`` \| ``"OKP"`` |

#### Defined in

[src/key/key.ts:6](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L6)

___

### generateFromSeedOptions

Ƭ **generateFromSeedOptions**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `secureRandom` | () => `Buffer` |

#### Defined in

[src/key/key.ts:5](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L5)

## Functions

### create

▸ **create**(`type`, `generateOptions?`): `Promise`<[`KeyDidDocAPI`](../classes/key.KeyDidDocAPI.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | [`KeyType`](key.md#keytype) |
| `generateOptions?` | [`generateFromSeedOptions`](key.md#generatefromseedoptions) \| [`generateFromRandomOptions`](key.md#generatefromrandomoptions) |

#### Returns

`Promise`<[`KeyDidDocAPI`](../classes/key.KeyDidDocAPI.md)\>

#### Defined in

[src/key/key.ts:33](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L33)

___

### inst

▸ **inst**(`state`): `Promise`<[`KeyDidDocAPI`](../classes/key.KeyDidDocAPI.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `state` | [`DidKeySerializedState`](key.md#didkeyserializedstate) |

#### Returns

`Promise`<[`KeyDidDocAPI`](../classes/key.KeyDidDocAPI.md)\>

#### Defined in

[src/key/key.ts:42](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L42)

___

### resolve

▸ **resolve**(`didUri`): `Promise`<[`ReadOnlyDidDocAPI`](../classes/ReadOnlyDidDocAPI.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `didUri` | `string` |

#### Returns

`Promise`<[`ReadOnlyDidDocAPI`](../classes/ReadOnlyDidDocAPI.md)\>

#### Defined in

[src/key/key.ts:26](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/key/key.ts#L26)
