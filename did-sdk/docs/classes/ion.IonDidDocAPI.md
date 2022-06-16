[@adx/did-sdk](../README.md) / [Exports](../modules.md) / [ion](../modules/ion.md) / IonDidDocAPI

# Class: IonDidDocAPI

[ion](../modules/ion.md).IonDidDocAPI

## Hierarchy

- `WritableDidDocAPI`

  ↳ **`IonDidDocAPI`**

## Table of contents

### Constructors

- [constructor](ion.IonDidDocAPI.md#constructor)

### Properties

- [\_didDoc](ion.IonDidDocAPI.md#_diddoc)
- [\_ionChallengeEndpoint](ion.IonDidDocAPI.md#_ionchallengeendpoint)
- [\_ionResolveEndpoint](ion.IonDidDocAPI.md#_ionresolveendpoint)
- [\_ionSolutionEndpoint](ion.IonDidDocAPI.md#_ionsolutionendpoint)
- [\_longForm](ion.IonDidDocAPI.md#_longform)
- [\_ops](ion.IonDidDocAPI.md#_ops)

### Accessors

- [didDoc](ion.IonDidDocAPI.md#diddoc)

### Methods

- [\_createLongForm](ion.IonDidDocAPI.md#_createlongform)
- [\_resolveDidDoc](ion.IonDidDocAPI.md#_resolvediddoc)
- [\_submitAnchorRequest](ion.IonDidDocAPI.md#_submitanchorrequest)
- [assertActive](ion.IonDidDocAPI.md#assertactive)
- [create](ion.IonDidDocAPI.md#create)
- [deactivate](ion.IonDidDocAPI.md#deactivate)
- [getAllOperations](ion.IonDidDocAPI.md#getalloperations)
- [getController](ion.IonDidDocAPI.md#getcontroller)
- [getLastOperation](ion.IonDidDocAPI.md#getlastoperation)
- [getOperation](ion.IonDidDocAPI.md#getoperation)
- [getPreviousOperation](ion.IonDidDocAPI.md#getpreviousoperation)
- [getPublicKey](ion.IonDidDocAPI.md#getpublickey)
- [getService](ion.IonDidDocAPI.md#getservice)
- [getSuffix](ion.IonDidDocAPI.md#getsuffix)
- [getURI](ion.IonDidDocAPI.md#geturi)
- [hydrate](ion.IonDidDocAPI.md#hydrate)
- [listPublicKeys](ion.IonDidDocAPI.md#listpublickeys)
- [listServices](ion.IonDidDocAPI.md#listservices)
- [recover](ion.IonDidDocAPI.md#recover)
- [serialize](ion.IonDidDocAPI.md#serialize)
- [update](ion.IonDidDocAPI.md#update)

## Constructors

### constructor

• **new IonDidDocAPI**(`options?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `options` | `Object` |
| `options.ionChallengeEndpoint?` | `string` |
| `options.ionResolveEndpoint?` | `string` |
| `options.ionSolutionEndpoint?` | `string` |
| `options.ops?` | [`Op`](../modules/ion.OPS.md#op)[] |

#### Overrides

WritableDidDocAPI.constructor

#### Defined in

[src/ion/ion.ts:89](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L89)

## Properties

### \_didDoc

• **\_didDoc**: `undefined` \| [`DIDDocument`](../modules.md#diddocument)

#### Defined in

[src/ion/ion.ts:83](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L83)

___

### \_ionChallengeEndpoint

• **\_ionChallengeEndpoint**: `string` = `CHALLENGE_ENDPOINT`

#### Defined in

[src/ion/ion.ts:86](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L86)

___

### \_ionResolveEndpoint

• **\_ionResolveEndpoint**: `string` = `RESOLVE_ENDPOINT`

#### Defined in

[src/ion/ion.ts:85](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L85)

___

### \_ionSolutionEndpoint

• **\_ionSolutionEndpoint**: `string` = `SOLUTION_ENDPOINT`

#### Defined in

[src/ion/ion.ts:87](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L87)

___

### \_longForm

• **\_longForm**: `undefined` \| `string`

#### Defined in

[src/ion/ion.ts:82](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L82)

___

### \_ops

• **\_ops**: [`Op`](../modules/ion.OPS.md#op)[]

#### Defined in

[src/ion/ion.ts:84](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L84)

## Accessors

### didDoc

• `get` **didDoc**(): [`DIDDocument`](../modules.md#diddocument)

#### Returns

[`DIDDocument`](../modules.md#diddocument)

#### Overrides

WritableDidDocAPI.didDoc

#### Defined in

[src/ion/ion.ts:110](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L110)

## Methods

### \_createLongForm

▸ `Private` **_createLongForm**(): `void`

#### Returns

`void`

#### Defined in

[src/ion/ion.ts:153](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L153)

___

### \_resolveDidDoc

▸ `Private` **_resolveDidDoc**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Defined in

[src/ion/ion.ts:171](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L171)

___

### \_submitAnchorRequest

▸ `Private` **_submitAnchorRequest**(`body`): `Promise`<`any`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `body` | `any` |

#### Returns

`Promise`<`any`\>

#### Defined in

[src/ion/ion.ts:177](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L177)

___

### assertActive

▸ **assertActive**(): `void`

#### Returns

`void`

#### Defined in

[src/ion/ion.ts:146](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L146)

___

### create

▸ **create**(`doc`, `options`): `Promise`<[`OpCreate`](../interfaces/ion.OPS.OpCreate.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `doc` | `default` |
| `options` | [`KeyParams`](../modules/ion.md#keyparams) |

#### Returns

`Promise`<[`OpCreate`](../interfaces/ion.OPS.OpCreate.md)\>

#### Defined in

[src/ion/ion.ts:200](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L200)

___

### deactivate

▸ **deactivate**(): `Promise`<[`OpDeactivate`](../interfaces/ion.OPS.OpDeactivate.md)\>

#### Returns

`Promise`<[`OpDeactivate`](../interfaces/ion.OPS.OpDeactivate.md)\>

#### Defined in

[src/ion/ion.ts:273](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L273)

___

### getAllOperations

▸ **getAllOperations**(): [`Op`](../modules/ion.OPS.md#op)[]

#### Returns

[`Op`](../modules/ion.OPS.md#op)[]

#### Defined in

[src/ion/ion.ts:120](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L120)

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

### getLastOperation

▸ **getLastOperation**(): [`Op`](../modules/ion.OPS.md#op)

#### Returns

[`Op`](../modules/ion.OPS.md#op)

#### Defined in

[src/ion/ion.ts:124](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L124)

___

### getOperation

▸ **getOperation**(`index`): [`Op`](../modules/ion.OPS.md#op)

#### Parameters

| Name | Type |
| :------ | :------ |
| `index` | `number` |

#### Returns

[`Op`](../modules/ion.OPS.md#op)

#### Defined in

[src/ion/ion.ts:138](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L138)

___

### getPreviousOperation

▸ **getPreviousOperation**(`type`): [`Op`](../modules/ion.OPS.md#op)

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |

#### Returns

[`Op`](../modules/ion.OPS.md#op)

#### Defined in

[src/ion/ion.ts:128](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L128)

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

### getSuffix

▸ **getSuffix**(): `string`

#### Returns

`string`

#### Defined in

[src/ion/ion.ts:142](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L142)

___

### getURI

▸ **getURI**(`form?`): `string`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `form` | `string` | `'long'` |

#### Returns

`string`

#### Overrides

WritableDidDocAPI.getURI

#### Defined in

[src/ion/ion.ts:189](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L189)

___

### hydrate

▸ **hydrate**(`state`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `state` | [`DidIonSerializedState`](../interfaces/ion.DidIonSerializedState.md) |

#### Returns

`Promise`<`void`\>

#### Overrides

WritableDidDocAPI.hydrate

#### Defined in

[src/ion/ion.ts:301](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L301)

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

### recover

▸ **recover**(`doc`, `options`): `Promise`<[`OpRecover`](../interfaces/ion.OPS.OpRecover.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `doc` | `default` |
| `options` | [`KeyParams`](../modules/ion.md#keyparams) |

#### Returns

`Promise`<[`OpRecover`](../interfaces/ion.OPS.OpRecover.md)\>

#### Defined in

[src/ion/ion.ts:247](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L247)

___

### serialize

▸ **serialize**(): [`DidIonSerializedState`](../interfaces/ion.DidIonSerializedState.md)

#### Returns

[`DidIonSerializedState`](../interfaces/ion.DidIonSerializedState.md)

#### Overrides

WritableDidDocAPI.serialize

#### Defined in

[src/ion/ion.ts:293](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L293)

___

### update

▸ **update**(`params`, `options`): `Promise`<[`OpUpdate`](../interfaces/ion.OPS.OpUpdate.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `params` | [`OpUpdateParams`](../interfaces/ion.OPS.OpUpdateParams.md) |
| `options` | [`KeyParams`](../modules/ion.md#keyparams) |

#### Returns

`Promise`<[`OpUpdate`](../interfaces/ion.OPS.OpUpdate.md)\>

#### Defined in

[src/ion/ion.ts:220](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ion.ts#L220)
