import { describe, expect, expectTypeOf, it } from 'vitest'
import { encode } from '@atproto/lex-cbor'
import type { CborCid, Cid, RawCid } from '@atproto/lex-data'
import { BlockMap } from './block-map.js'

describe(BlockMap, () => {
  it('types add() only for maps whose TCid accepts a CborCid', async () => {
    await new BlockMap<CborCid>().add({ foo: 'bar' })
    await new BlockMap<Cid>().add({ foo: 'bar' })
    await new BlockMap<CborCid | RawCid>().add({ foo: 'bar' })
    // @ts-expect-error a RawCid map cannot hold a CborCid
    await new BlockMap<RawCid>().add({ foo: 'bar' })
  })

  it('is covariant in TCid', () => {
    expectTypeOf<BlockMap<CborCid>>().toExtend<BlockMap<Cid>>()
    expectTypeOf<BlockMap<Cid>>().not.toExtend<BlockMap<CborCid>>()
  })

  it('reads back added values with any Cid', async () => {
    const map = new BlockMap<CborCid>()
    const cid: Cid = await map.add({ foo: 'bar' })
    expect(map.get(cid)).toEqual(encode({ foo: 'bar' }))
    expect(map.getMany([cid]).missing).toEqual([])
  })

  it('iterates blocks that do not alias its entries', async () => {
    const map = new BlockMap<CborCid>()
    const cid = await map.add({ foo: 'bar' })

    const [block] = map
    expect(block).toEqual({ cid, bytes: encode({ foo: 'bar' }) })
    block.bytes = new Uint8Array()
    expect(map.get(cid)).toEqual(encode({ foo: 'bar' }))
  })

  it.each([
    ['the constructor', (src: BlockMap<CborCid>) => new BlockMap(src)],
    ['from()', (src: BlockMap<CborCid>) => BlockMap.from(src)],
    ['addBlocks()', (src: BlockMap<CborCid>) => new BlockMap().addBlocks(src)],
  ])('copies a source map through %s', async (_, copy) => {
    const source = new BlockMap<CborCid>()
    const cid = await source.add({ foo: 'bar' })

    const copied = await copy(source)
    await copied.add({ baz: 'qux' })
    expect(copied.get(cid)).toEqual(source.get(cid))
    expect(copied.size).toBe(2)
    expect(source.size).toBe(1)
  })
})
