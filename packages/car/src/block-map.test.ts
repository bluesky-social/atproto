import { describe, expect, it } from 'vitest'
import type { CborCid, Cid, RawCid } from '@atproto/lex-data'
import { BlockMap } from './block-map.js'

describe(BlockMap, () => {
  it('should not allow adding cbor values when CborCid is not assignable to TCid', async () => {
    const rawMap = new BlockMap<RawCid>()
    // @ts-expect-error
    await rawMap.add({ foo: 'bar' })
  })

  it('allows adding cbor values when CborCid is assignable to TCid', async () => {
    const cborMap = new BlockMap<CborCid>()
    await cborMap.add({ foo: 'bar' })

    const cidMap = new BlockMap<Cid>()
    await cidMap.add({ foo: 'bar' })

    const rawOrCborMap = new BlockMap<CborCid | RawCid>()
    await rawOrCborMap.add({ foo: 'bar' })
  })

  it('is covariant in TCid', () => {
    const cborMap = new BlockMap<CborCid>()
    const cidMap: BlockMap<Cid> = cborMap
    // @ts-expect-error
    const narrowed: BlockMap<CborCid> = cidMap
    void narrowed
  })

  it('allows reading with any Cid', async () => {
    const cborMap = new BlockMap<CborCid>()
    const cid: Cid = await cborMap.add({ foo: 'bar' })
    expect(cborMap.get(cid)).toBeDefined()
    expect(cborMap.has(cid)).toBe(true)
    expect(cborMap.getMany([cid]).missing).toEqual([])
  })
})
