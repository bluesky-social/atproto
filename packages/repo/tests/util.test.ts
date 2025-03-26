import { dataToCborBlock, wait } from '@atproto/common'
import { writeCarStream } from '../src'

describe('Utils', () => {
  describe('writeCar()', () => {
    it('propagates errors', async () => {
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
})
