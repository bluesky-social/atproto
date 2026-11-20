import { describe, expect, it } from 'vitest'
import { encode } from '@atproto/lex-cbor'
import { type CborCid, ui8Concat, ui8ConcatAsync } from '@atproto/lex-data'
import { BlockMap } from './block-map.js'
import type { CarBlock } from './car-block.js'
import { CarReader } from './car-reader.js'
import { encodeVarInt } from './lib/varint.js'
import { readCarWithRoot } from './read.js'
import { encodeCarBlock, encodeCarHeader, writeCarStream } from './write.js'

const summarize = (blocks: Iterable<CarBlock>) =>
  Array.from(blocks, ({ cid, bytes }) => ({ cid: cid.toString(), bytes }))

/** A car whose one block's bytes do not match its CID. */
const badCar = async () => {
  const blocks = new BlockMap<CborCid>()
  const cid = await blocks.add({ block: 0 })
  return writeCarStream(cid, [{ cid, bytes: encode({ block: 'bad' }) }])
}

describe(CarReader, () => {
  it('reads a car from a single Uint8Array', async () => {
    const blocks = new BlockMap<CborCid>()
    const cid = await blocks.add({ block: 0 })
    const car = await ui8ConcatAsync(writeCarStream(cid, blocks))

    await using reader = await CarReader.from(car)
    expect(reader.roots.map(String)).toEqual([cid.toString()])
    expect(summarize(await BlockMap.from(reader))).toEqual(summarize(blocks))
  })

  it('rejects a truncated car', async () => {
    const car = encodeCarHeader(null)
    await expect(CarReader.from(car.subarray(0, 3))).rejects.toThrow(
      'not enough data',
    )
  })

  it.each([
    ['version', { version: 2, roots: [] }],
    ['roots', { version: 1, roots: {} }],
  ])('rejects a header with an invalid %s', async (_, header) => {
    const bytes = encode(header)
    const car = ui8Concat([encodeVarInt(bytes.byteLength), bytes])
    await expect(CarReader.from(car)).rejects.toThrow(
      'Could not parse CAR header',
    )
  })

  it('rejects a block whose bytes do not match its CID', async () => {
    await using reader = await CarReader.from(await badCar())
    await expect(BlockMap.from(reader)).rejects.toThrow(
      'Not a valid CID for bytes',
    )
  })

  it('skips CID verification when asked', async () => {
    await using reader = await CarReader.from(await badCar(), {
      skipCidVerification: true,
    })
    await expect(BlockMap.from(reader)).resolves.toHaveProperty('size', 1)
  })

  it('closes its input when disposed before iterating', async () => {
    const blocks = new BlockMap<CborCid>()
    const cid = await blocks.add({ block: 0 })
    let closed = false
    const input = async function* () {
      try {
        yield encodeCarHeader(cid)
        yield* Array.from(blocks, encodeCarBlock)
      } finally {
        closed = true
      }
    }

    const reader = await CarReader.from(input())
    expect(closed).toBe(false)
    await reader[Symbol.asyncDispose]()
    expect(closed).toBe(true)
  })
})

describe(readCarWithRoot, () => {
  it('rejects a car with more than one root', async () => {
    const blocks = new BlockMap<CborCid>()
    const roots = [await blocks.add({ root: 1 }), await blocks.add({ root: 2 })]
    await expect(
      readCarWithRoot(writeCarStream(roots, blocks)),
    ).rejects.toThrow('Expected one root, got 2')
  })
})
