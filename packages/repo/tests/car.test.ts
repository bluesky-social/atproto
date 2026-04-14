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
import { CarBlock, readCarStream, writeCarStream } from '../src'
import fixtures from './car-file-fixtures.json'

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
