[@adx/did-sdk](../README.md) / [Exports](../modules.md) / [ion](../modules/ion.md) / [OPS](../modules/ion.OPS.md) / OpCreate

# Interface: OpCreate

[ion](../modules/ion.md).[OPS](../modules/ion.OPS.md).OpCreate

## Hierarchy

- `BaseOp`

  ↳ **`OpCreate`**

## Table of contents

### Properties

- [content](ion.OPS.OpCreate.md#content)
- [operation](ion.OPS.OpCreate.md#operation)
- [previous](ion.OPS.OpCreate.md#previous)
- [recovery](ion.OPS.OpCreate.md#recovery)
- [update](ion.OPS.OpCreate.md#update)

## Properties

### content

• **content**: `default`

#### Defined in

[src/ion/ops.ts:14](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ops.ts#L14)

___

### operation

• **operation**: ``"create"``

#### Defined in

[src/ion/ops.ts:13](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ops.ts#L13)

___

### previous

• `Optional` **previous**: `BaseOp`

#### Inherited from

BaseOp.previous

#### Defined in

[src/ion/ops.ts:7](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ops.ts#L7)

___

### recovery

• **recovery**: `KeyPair`

#### Overrides

BaseOp.recovery

#### Defined in

[src/ion/ops.ts:16](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ops.ts#L16)

___

### update

• **update**: `KeyPair`

#### Overrides

BaseOp.update

#### Defined in

[src/ion/ops.ts:15](https://github.com/bluesky-social/bluesky-prototype/blob/05593da/did-sdk/src/ion/ops.ts#L15)
