import { readFromGenerator, wait } from '../src'

describe('async', () => {
  describe('readFromGenerator', () => {
    async function* waitToYield(time: number) {
      for (let i = 0; i < 5; i++) {
        await wait(time)
        yield true
      }
    }

    it('reads from generator with timeout', async () => {
      const read = await readFromGenerator(waitToYield(100), undefined, 105)
      expect(read).toEqual([true, true, true, true, true])
    })

    it('stops reading at timeout', async () => {
      const read = await readFromGenerator(waitToYield(100), undefined, 95)
      expect(read).toEqual([])
    })
  })
})
