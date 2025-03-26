import { dataToCborBlock, wait } from '@atproto/common'
import { readCarStream, writeCarStream } from '../src'
import { randomStr } from './_util'

describe('car', () => {
  it('test', async () => {
    const randomBlock = async () => {
      const block = await dataToCborBlock({ test: randomStr(50) })
      return { cid: block.cid, bytes: block.bytes }
    }
    const root = await randomBlock()
    async function* blockIterator() {
      await wait(1)
      yield root
      for (let i = 0; i < 5; i++) {
        yield await randomBlock()
      }
    }
    const car = writeCarStream(root.cid, blockIterator())

    await readCarStream(car)
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
})
