[@adx/did-sdk](../README.md) / [Exports](../modules.md) / [ion](../modules/ion.md) / [OPS](../modules/ion.OPS.md) / OpUpdate

# Interface: OpUpdate

[ion](../modules/ion.md).[OPS](../modules/ion.OPS.md).OpUpdate

## Hierarchy

- `BaseOp`

  ↳ **`OpUpdate`**

## Table of contents

### Properties

- [content](ion.OPS.OpUpdate.md#content)
- [operation](ion.OPS.OpUpdate.md#operation)
- [previous](ion.OPS.OpUpdate.md#previous)
- [recovery](ion.OPS.OpUpdate.md#recovery)
- [update](ion.OPS.OpUpdate.md#update)

## Properties

### content

• **content**: [`OpUpdateParams`](ion.OPS.OpUpdateParams.md)

#### Defined in

[src/ion/ops.ts:28](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ops.ts#L28)

___

### operation

• **operation**: ``"update"``

#### Defined in

[src/ion/ops.ts:27](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ops.ts#L27)

___

### previous

• **previous**: `BaseOp`

#### Overrides

BaseOp.previous

#### Defined in

[src/ion/ops.ts:30](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ops.ts#L30)

___

### recovery

• `Optional` **recovery**: `KeyPair`

#### Inherited from

BaseOp.recovery

#### Defined in

[src/ion/ops.ts:9](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ops.ts#L9)

___

### update

• **update**: `KeyPair`

#### Overrides

BaseOp.update

#### Defined in

[src/ion/ops.ts:29](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ops.ts#L29)
