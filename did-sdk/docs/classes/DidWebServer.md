[@adx/did-sdk](../README.md) / [Exports](../modules.md) / DidWebServer

# Class: DidWebServer

## Table of contents

### Constructors

- [constructor](DidWebServer.md#constructor)

### Properties

- [\_server](DidWebServer.md#_server)
- [dids](DidWebServer.md#dids)
- [port](DidWebServer.md#port)
- [whenReady](DidWebServer.md#whenready)

### Methods

- [\_idToPath](DidWebServer.md#_idtopath)
- [\_onRequest](DidWebServer.md#_onrequest)
- [close](DidWebServer.md#close)
- [delete](DidWebServer.md#delete)
- [put](DidWebServer.md#put)

## Constructors

### constructor

• **new DidWebServer**(`port`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `port` | `number` |

#### Defined in

[src/web/server.ts:11](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/web/server.ts#L11)

## Properties

### \_server

• **\_server**: `Server`

#### Defined in

[src/web/server.ts:7](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/web/server.ts#L7)

___

### dids

• **dids**: `Map`<`string`, [`DIDDocument`](../modules.md#diddocument)\>

#### Defined in

[src/web/server.ts:8](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/web/server.ts#L8)

___

### port

• **port**: `number`

___

### whenReady

• **whenReady**: `Promise`<`void`\>

#### Defined in

[src/web/server.ts:9](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/web/server.ts#L9)

## Methods

### \_idToPath

▸ **_idToPath**(`id`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `id` | `string` |

#### Returns

`string`

#### Defined in

[src/web/server.ts:33](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/web/server.ts#L33)

___

### \_onRequest

▸ **_onRequest**(`req`, `res`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `req` | `IncomingMessage` |
| `res` | `ServerResponse` |

#### Returns

`void`

#### Defined in

[src/web/server.ts:20](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/web/server.ts#L20)

___

### close

▸ **close**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Defined in

[src/web/server.ts:57](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/web/server.ts#L57)

___

### delete

▸ **delete**(`did`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `did` | `string` \| [`DIDDocument`](../modules.md#diddocument) |

#### Returns

`void`

#### Defined in

[src/web/server.ts:49](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/web/server.ts#L49)

___

### put

▸ **put**(`didDoc`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `didDoc` | [`DIDDocument`](../modules.md#diddocument) |

#### Returns

`void`

#### Defined in

[src/web/server.ts:45](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/web/server.ts#L45)
