[@adx/did-sdk](../README.md) / [Exports](../modules.md) / ion

# Namespace: ion

## Table of contents

### Namespaces

- [OPS](ion.OPS.md)

### Classes

- [IonDidDocAPI](../classes/ion.IonDidDocAPI.md)

### Interfaces

- [DidIonSerializedState](../interfaces/ion.DidIonSerializedState.md)

### Type Aliases

- [CreateParams](ion.md#createparams)
- [KeyParams](ion.md#keyparams)
- [KeyType](ion.md#keytype)
- [RecoverParams](ion.md#recoverparams)
- [UpdateParams](ion.md#updateparams)
- [generateFromSeedOptions](ion.md#generatefromseedoptions)

### Functions

- [create](ion.md#create)
- [inst](ion.md#inst)
- [resolve](ion.md#resolve)

## Type Aliases

### CreateParams

Ƭ **CreateParams**: `IonDocumentModel`

#### Defined in

[src/ion/ion.ts:28](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L28)

___

### KeyParams

Ƭ **KeyParams**: [`generateFromSeedOptions`](ion.md#generatefromseedoptions) & { `keyType`: [`KeyType`](ion.md#keytype)  }

#### Defined in

[src/ion/ion.ts:31](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L31)

___

### KeyType

Ƭ **KeyType**: ``"ed25519"`` \| ``"secp256k1"``

#### Defined in

[src/ion/keypairs.ts:5](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/keypairs.ts#L5)

___

### RecoverParams

Ƭ **RecoverParams**: `IonDocumentModel`

#### Defined in

[src/ion/ion.ts:30](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L30)

___

### UpdateParams

Ƭ **UpdateParams**: [`OpUpdateParams`](../interfaces/ion.OPS.OpUpdateParams.md)

#### Defined in

[src/ion/ion.ts:29](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L29)

___

### generateFromSeedOptions

Ƭ **generateFromSeedOptions**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `secureRandom` | () => `Buffer` |

#### Defined in

[src/ion/keypairs.ts:6](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/keypairs.ts#L6)

## Functions

### create

▸ **create**(`doc`, `options`): `Promise`<[`IonDidDocAPI`](../classes/ion.IonDidDocAPI.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `doc` | `default` |
| `options` | { `ionChallengeEndpoint?`: `string` ; `ionResolveEndpoint?`: `string` ; `ionSolutionEndpoint?`: `string`  } & [`generateFromSeedOptions`](ion.md#generatefromseedoptions) & { `keyType`: [`KeyType`](ion.md#keytype)  } |

#### Returns

`Promise`<[`IonDidDocAPI`](../classes/ion.IonDidDocAPI.md)\>

#### Defined in

[src/ion/ion.ts:55](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L55)

___

### inst

▸ **inst**(`state`, `options?`): `Promise`<[`IonDidDocAPI`](../classes/ion.IonDidDocAPI.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `state` | [`DidIonSerializedState`](../interfaces/ion.DidIonSerializedState.md) |
| `options` | `Object` |
| `options.ionChallengeEndpoint?` | `string` |
| `options.ionResolveEndpoint?` | `string` |
| `options.ionSolutionEndpoint?` | `string` |

#### Returns

`Promise`<[`IonDidDocAPI`](../classes/ion.IonDidDocAPI.md)\>

#### Defined in

[src/ion/ion.ts:68](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L68)

___

### resolve

▸ **resolve**(`didUri`, `ionResolveEndpoint?`): `Promise`<[`ReadOnlyDidDocAPI`](../classes/ReadOnlyDidDocAPI.md)\>

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `didUri` | `string` | `undefined` |
| `ionResolveEndpoint` | `string` | `RESOLVE_ENDPOINT` |

#### Returns

`Promise`<[`ReadOnlyDidDocAPI`](../classes/ReadOnlyDidDocAPI.md)\>

#### Defined in

[src/ion/ion.ts:44](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L44)
