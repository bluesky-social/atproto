import { dataToCborBlock, wait } from '@atproto/common'
import { writeCar } from '../src'

describe('Utils', () => {
  describe('writeCar()', () => {
    it('propagates errors', async () => {
      const iterate = async () => {
        const iter = writeCar(null, async (car) => {
          await wait(1)
          const block = await dataToCborBlock({ test: 1 })
          await car.put(block)
          throw new Error('Oops!')
        })
        for await (const _bytes of iter) {
          // no-op
        }
      }
      await expect(iterate).rejects.toThrow('Oops!')
    })
  })
})
