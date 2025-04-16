import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
import { dataToCborBlock, streamToBytes, wait } from '@atproto/common'
import { CarBlock, readCarStream, writeCarStream } from '../src'
import fixtures from './car-file-fixtures.json'

describe('car', () => {
  for (const fixture of fixtures) {
    it('correctly writes car files', async () => {
      const root = CID.parse(fixture.root)
      async function* blockIter() {
        for (const block of fixture.blocks) {
          const cid = CID.parse(block.cid)
          const bytes = ui8.fromString(block.bytes, 'base64')
          yield { cid, bytes }
        }
      }
      const carStream = writeCarStream(root, blockIter())
      const car = await streamToBytes(carStream)
      const carB64 = ui8.toString(car, 'base64')
      expect(carB64).toEqual(fixture.car)
    })

    it('correctly reads carfiles', async () => {
      const carStream = [ui8.fromString(fixture.car, 'base64')]
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
        expect(ui8.toString(carBlocks[i].bytes, 'base64')).toEqual(
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
})
