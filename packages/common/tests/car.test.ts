import { wait } from '@atproto/common-web'
import { encode } from '@atproto/lex-cbor'
import {
  Cid,
  LexValue,
  cidForCbor,
  fromBase64,
  parseCid,
  toBase64,
} from '@atproto/lex-data'
import {
  CarBlock,
  readCarBytes,
  readCarStream,
  writeCarStream,
} from '../src/index.js'
import fixtures from './car-file-fixtures.json' with { type: 'json' }

async function dataToCborBlock(data: LexValue): Promise<{
  cid: Cid
  bytes: Uint8Array
}> {
  const bytes = encode(data)
  const cid = await cidForCbor(bytes)
  return { cid, bytes }
}

describe('car', () => {
  for (const fixture of fixtures) {
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
  }

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
    const { roots } = await readCarStream(writeCarStream(null, [block]))
    expect(roots).toEqual([])
  })

  it('reads from bytes as well as a stream', async () => {
    const block = await dataToCborBlock({ block: 0 })
    const chunks: Uint8Array[] = []
    for await (const chunk of writeCarStream(block.cid, [block])) {
      chunks.push(chunk)
    }
    const { roots, blocks } = await readCarBytes(Buffer.concat(chunks))
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
    await expect(readCarBytes(car.subarray(0, 3))).rejects.toThrow()
  })

  it('writeCar propagates errors', async () => {
    const iterate = async () => {
      async function* blockIterator() {
        await wait(1)
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
    const badCar = await readCarStream(writeCarStream(block0.cid, blockIter()))
    await expect(flush(badCar.blocks)).rejects.toThrow(
      'Not a valid CID for bytes',
    )
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
    const badCar = await readCarStream(
      writeCarStream(block0.cid, blockIter()),
      { skipCidVerification: true },
    )
    await expect(flush(badCar.blocks)).resolves.toBeUndefined()
  })
})
