import { describe, expect, it } from 'vitest'
import { type CborCid, ui8ConcatAsync } from '@atproto/lex-data'
import { BlockMap } from './block-map.js'
import { readCar } from './read.js'
import { writeCarStream } from './write.js'

describe(writeCarStream, () => {
  it('round-trips multiple roots, in order', async () => {
    const blocks = new BlockMap<CborCid>()
    const roots = [await blocks.add({ root: 1 }), await blocks.add({ root: 2 })]

    const car = await readCar(writeCarStream(roots, blocks))
    expect(car.roots.map(String)).toEqual(roots.map(String))
    expect(car.blocks.equals(blocks)).toBe(true)
  })

  it('treats a bare cid and a single-element list alike', async () => {
    const blocks = new BlockMap<CborCid>()
    const cid = await blocks.add({ block: 0 })
    expect(await ui8ConcatAsync(writeCarStream([cid], blocks))).toEqual(
      await ui8ConcatAsync(writeCarStream(cid, blocks)),
    )
  })

  it('writes no roots for null', async () => {
    const blocks = new BlockMap<CborCid>()
    await blocks.add({ block: 0 })
    const car = await readCar(writeCarStream(null, blocks))
    expect(car.roots).toEqual([])
  })

  it('propagates errors from the block source', async () => {
    const blocks = new BlockMap<CborCid>()
    await blocks.add({ block: 0 })
    async function* failing() {
      yield* blocks
      throw new Error('Oops!')
    }
    await expect(
      ui8ConcatAsync(writeCarStream(null, failing())),
    ).rejects.toThrow('Oops!')
  })
})
