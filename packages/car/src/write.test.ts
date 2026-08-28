import { setTimeout } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { encode } from '@atproto/lex-cbor'
import { type Cid, type LexValue, cidForCbor } from '@atproto/lex-data'
import { readCarStream } from './read.js'
import { writeCarStream } from './write.js'

describe(writeCarStream, () => {
  it('treats a bare cid and a single-element list alike', async () => {
    const block = await dataToCborBlock({ block: 0 })
    const chunks: Uint8Array[] = []
    for await (const chunk of writeCarStream(block.cid, [block])) {
      chunks.push(chunk)
    }
    const bare = Buffer.concat(chunks)

    chunks.length = 0
    for await (const chunk of writeCarStream([block.cid], [block])) {
      chunks.push(chunk)
    }
    expect(Buffer.concat(chunks)).toEqual(bare)
  })

  it('writes no roots for null', async () => {
    const block = await dataToCborBlock({ block: 0 })
    await using reader = await readCarStream(writeCarStream(null, [block]))
    expect(reader.roots).toEqual([])
  })

  it('propagates errors', async () => {
    const iterate = async () => {
      async function* blockIterator() {
        await setTimeout(1)
        const block = await dataToCborBlock({ test: 1 })
        yield block
        throw new Error('Oops!')
      }
      const iter = writeCarStream(null, blockIterator())
      for await (const _bytes of iter) {
        // no-op
      }
    }
    await expect(iterate).rejects.toThrow('Oops!')
  })

  it('verifies CIDs', async () => {
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
    await using badCar = await readCarStream(
      writeCarStream(block0.cid, blockIter()),
    )
    await expect(flush(badCar.blocks)).rejects.toThrow(
      'Not a valid CID for bytes',
    )
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
