import { describe, expect, it } from 'vitest'
import { encode } from '@atproto/lex-cbor'
import { type Cid, type LexValue, cidForCbor } from '@atproto/lex-data'
import type { CarBlock } from './car-block.ts'
import { CarReader } from './car-reader.ts'
import { writeCarStream } from './write.ts'

describe(CarReader, () => {
  it('reads from bytes as well as a stream', async () => {
    const block = await dataToCborBlock({ block: 0 })
    const chunks: Uint8Array[] = []
    for await (const chunk of writeCarStream(block.cid, [block])) {
      chunks.push(chunk)
    }
    await using reader = await CarReader.from(Buffer.concat(chunks))
    const { roots, blocks } = reader
    expect(roots[0].toString()).toBe(block.cid.toString())
    const seen: CarBlock[] = []
    for await (const b of blocks) seen.push(b)
    expect(seen).toHaveLength(1)
  })

  it('rejects a truncated car', async () => {
    const block = await dataToCborBlock({ block: 0 })
    const chunks: Uint8Array[] = []
    for await (const chunk of writeCarStream(block.cid, [block])) {
      chunks.push(chunk)
    }
    const car = Buffer.concat(chunks)
    await expect(CarReader.from(car.subarray(0, 3))).rejects.toThrow()
  })

  it('skips CID verification', async () => {
    const block0 = await dataToCborBlock({ block: 0 })
    const block1 = await dataToCborBlock({ block: 1 })
    const block2 = await dataToCborBlock({ block: 2 })
    const block3 = await dataToCborBlock({ block: 3 })
    const badBlock = await dataToCborBlock({ block: 'bad' })
    const blockIter = async function* () {
      yield block0
      yield block1
      yield block2
      yield { cid: block3.cid, bytes: badBlock.bytes }
    }
    const flush = async function (iter: AsyncIterable<unknown>) {
      for await (const _ of iter) {
        // no-op
      }
    }
    const badCar = await CarReader.from(
      writeCarStream(block0.cid, blockIter()),
      {
        skipCidVerification: true,
      },
    )
    await expect(flush(badCar.blocks)).resolves.toBeUndefined()
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
