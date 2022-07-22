import MST from '../src/repo/mst'

import * as util from './_util'
import { IpldStore } from '../src'

describe('Merkle Search Tree', () => {
  it('works', async () => {
    const blockstore = IpldStore.createInMemory()
    const mst = await MST.create(blockstore)
    const mapping = await util.generateBulkTidMapping(1000)
    const shuffled = shuffle(Object.entries(mapping))
    for (const entry of shuffled) {
      await mst.set(entry[0], entry[1])
    }

    for (const entry of shuffled) {
      const got = await mst.get(entry[0])
      expect(entry[1].equals(got)).toBeTruthy()
    }
  })

  /**
   *
   *                *                                  *
   *       _________|________                      ____|_____
   *       |   |    |    |   |                    |    |     |
   *       *   d    *    i   *       ->           *    f     *
   *     __|__    __|__    __|__                __|__      __|___
   *    |  |  |  |  |  |  |  |  |              |  |  |    |  |   |
   *    a  b  c  e  g  h  j  k  l              *  d  *    *  i   *
   *                                         __|__   |   _|_   __|__
   *                                        |  |  |  e  |   | |  |  |
   *                                        a  b  c     g   h j  k  l
   *
   */
  it('handles splits that must go 2 deep', async () => {
    const layer0 = [
      '3j6hnk65jis2t',
      '3j6hnk65jit2t',
      '3j6hnk65jiu2t',
      '3j6hnk65jne2t',
      '3j6hnk65jnm2t',
      '3j6hnk65jnn2t',
      '3j6hnk65kvx2t',
      '3j6hnk65kvy2t',
      '3j6hnk65kvz2t',
    ]
    const layer1 = ['3j6hnk65jju2t', '3j6hnk65kve2t']
    const layer2 = '3j6hnk65jng2t'
    const blockstore = IpldStore.createInMemory()
    const mst = await MST.create(blockstore)
    const cid = await util.randomCid()

    for (const tid of layer0) {
      await mst.set(tid, cid)
    }
    for (const tid of layer1) {
      await mst.set(tid, cid)
    }
    await mst.set(layer2, cid)
    expect(mst.zeros).toBe(2)

    const allTids = [...layer0, ...layer1, layer2]
    for (const tid of allTids) {
      const got = await mst.get(tid)
      expect(cid.equals(got)).toBeTruthy()
    }
  })

  /**
   *
   *          *        ->            *
   *        __|__                  __|__
   *       |     |                |  |  |
   *       a     c                *  b  *
   *                              |     |
   *                              *     *
   *                              |     |
   *                              a     c
   *
   */
  it('handles new layers that are two higher than existing', async () => {
    const layer0 = [
      '3j6hnk65jis2t',
      '3j6hnk65jit2t',
      '3j6hnk65jiu2t',
      '3j6hnk65jis2t',
      '3j6hnk65jit2t',
      '3j6hnk65jiu2t',
    ]
    const layer1 = ['3j6hnk65jju2t', '3j6hnk65l222t']
    const layer2 = '3j6hnk65jng2t'
    const blockstore = IpldStore.createInMemory()
    const mst = await MST.create(blockstore)
    const cid = await util.randomCid()
    for (const tid of layer0) {
      await mst.set(tid, cid)
    }
    await mst.set(layer2, cid)
    for (const tid of layer1) {
      await mst.set(tid, cid)
    }

    expect(mst.zeros).toBe(2)
    const allTids = [...layer0, ...layer1, layer2]
    for (const tid of allTids) {
      const got = await mst.get(tid)
      expect(cid.equals(got)).toBeTruthy()
    }
  })
})

const shuffle = <T>(arr: T[]): T[] => {
  let toShuffle = [...arr]
  let shuffled: T[] = []
  while (toShuffle.length > 0) {
    const index = Math.floor(Math.random() * toShuffle.length)
    shuffled.push(toShuffle[index])
    toShuffle.splice(index, 1)
  }
  return shuffled
}
