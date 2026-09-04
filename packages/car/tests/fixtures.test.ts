import { describe, expect, it } from 'vitest'
import { encode } from '@atproto/lex-cbor'
import {
  type Cid,
  type LexValue,
  cidForCbor,
  fromBase64,
  parseCid,
  toBase64,
} from '@atproto/lex-data'
import { type CarBlock, readCarStream, writeCarStream } from '../src/index.js'
import fixtures from '../tests/car-file-fixtures.json' with { type: 'json' }

describe.each(fixtures)('fixture', async (fixture) => {
  it('correctly reads carfiles', async () => {
    const carStream = [fromBase64(fixture.car, 'base64')]
    const { roots, blocks } = await readCarStream(carStream)
    expect(roots.length).toBe(1)
    expect(roots[0].toString()).toEqual(fixture.root)
    const carBlocks: CarBlock[] = []
    for await (const block of blocks) {
      carBlocks.push(block)
    }
    expect(carBlocks.length).toEqual(fixture.blocks.length)
    for (let i = 0; i < carBlocks.length; i++) {
      expect(carBlocks[i].cid.toString()).toEqual(fixture.blocks[i].cid)
      expect(toBase64(carBlocks[i].bytes, 'base64')).toEqual(
        fixture.blocks[i].bytes,
      )
    }
  })

  it('round-trips multiple roots, in order', async () => {
    const first = await dataToCborBlock({ root: 'first' })
    const second = await dataToCborBlock({ root: 'second' })
    const car = writeCarStream([first.cid, second.cid], [first, second])

    const { roots, blocks } = await readCarStream(car)
    expect(roots.map((r) => r.toString())).toEqual([
      first.cid.toString(),
      second.cid.toString(),
    ])
    const seen: CarBlock[] = []
    for await (const block of blocks) seen.push(block)
    expect(seen.map((b) => b.cid.toString())).toEqual([
      first.cid.toString(),
      second.cid.toString(),
    ])
  })

  it('correctly writes car files', async () => {
    const root = parseCid(fixture.root)
    async function* blockIter() {
      for (const block of fixture.blocks) {
        const cid = parseCid(block.cid)
        const bytes = fromBase64(block.bytes, 'base64')
        yield { cid, bytes }
      }
    }
    const carStream = writeCarStream(root, blockIter())
    const chunks: Uint8Array[] = []
    for await (const chunk of carStream) {
      chunks.push(chunk)
    }
    const car = Buffer.concat(chunks)
    // @NOTE Not using car.toString('base64') because of padding differences
    expect(toBase64(car)).toEqual(fixture.car)
  })
})

async function dataToCborBlock(data: LexValue): Promise<{
  cid: Cid
  bytes: Uint8Array
}> {
  const bytes = encode(data)
  const cid = await cidForCbor(bytes)
  return { cid, bytes }
}
