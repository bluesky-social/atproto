import { dataToCborBlock, wait } from '@atproto/common'
import { readCarNew, writeCar } from '../src'
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
    const car = writeCar(root.cid, blockIterator())

    await readCarNew(car)
  })
})
