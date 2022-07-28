import MST from '../src/repo/mst/mst'

import * as util from './_util'
import { IpldStore } from '../src'
import { CID } from 'multiformats'
import fs from 'fs'

describe('Merkle Search Tree', () => {
  // it('height of all stupidity', async () => {
  //   const blockstore = IpldStore.createInMemory()
  //   const mst = await MST.create(blockstore)
  //   const toMerge = await MST.create(blockstore)
  //   const mapping = await util.generateBulkTidMapping(500)
  //   const shuffled = shuffle(Object.entries(mapping))
  //   for (const entry of shuffled.slice(0, 350)) {
  //     await mst.add(entry[0], entry[1])
  //     await toMerge.add(entry[0], entry[1])
  //   }
  //   for (const entry of shuffled.slice(350, 400)) {
  //     await mst.add(entry[0], entry[1])
  //   }
  //   for (const entry of shuffled.slice(400)) {
  //     await toMerge.add(entry[0], entry[1])
  //   }
  //   console.log('zeros 1: ', mst.zeros)
  //   console.log('zeros 2: ', toMerge.zeros)
  //   await mst.mergeIn(toMerge)
  //   for (const entry of shuffled) {
  //     const got = await mst.get(entry[0])
  //     expect(entry[1].equals(got)).toBeTruthy()
  //   }
  // })
  // it('merges', async () => {
  //   const blockstore = IpldStore.createInMemory()
  //   const mst = await MST.create(blockstore)
  //   const toMerge = await MST.create(blockstore)
  //   // const mapping = await util.generateBulkTidMapping(500)
  //   // const shuffled = shuffle(Object.entries(mapping))
  //   const values: Record<string, CID> = {}
  //   const layer1 = ['3j6hnk65jju2t']
  //   const layer0 = ['3j6hnk65jis2t', '3j6hnk65jit2t']
  //   const newKeys = ['3j6hnk65jnm2t']
  //   const all = [...layer0, ...layer1]
  //   for (const tid of all) {
  //     const cid = await util.randomCid()
  //     values[tid] = cid
  //     await mst.add(tid, cid)
  //     await toMerge.add(tid, cid)
  //   }
  //   console.log('ADDING NEW KEYS')
  //   for (const tid of newKeys) {
  //     const cid = await util.randomCid()
  //     values[tid] = cid
  //     await toMerge.add(tid, cid)
  //   }
  //   console.log('MERGING')
  //   await mst.mergeIn(toMerge)
  //   const structure = await mst.structure()
  //   let output = ''
  //   await mst.walk((lvl, key) => {
  //     if (key) {
  //       output += `${lvl}: ${key}\n`
  //     }
  //     output += `${lvl}\n`
  //   })
  //   fs.writeFileSync('structure', output)
  //   // const tree = {
  //   //   0: [],
  //   //   1: [],
  //   //   2: [],
  //   // }
  //   // await mst.walk((lvl, key) => {
  //   //   tree[lvl].push(key)
  //   // })
  //   // console.log(tree)
  //   const got = await mst.get(newKeys[0])
  //   console.log('GOT: ', got)
  //   // for (const entry of Object.entries(values)) {
  //   //   const got = await mst.get(entry[0])
  //   //   expect(entry[1].equals(got)).toBeTruthy()
  //   // }
  // })

  it('works', async () => {
    const blockstore = IpldStore.createInMemory()
    let mst = await MST.create(blockstore)
    const mapping = await util.generateBulkTidMapping(1000)
    const shuffled = shuffle(Object.entries(mapping))
    for (const entry of shuffled) {
      mst = await mst.add(entry[0], entry[1])
    }
    for (const entry of shuffled) {
      const got = await mst.get(entry[0])
      expect(entry[1].equals(got)).toBeTruthy()
    }
  })

  /**
   *   `f` gets added & it does two node splits (e is no longer grouped with g/h)
   *
   *                *                                  *
   *       _________|________                      ____|_____
   *       |   |    |    |   |                    |    |     |
   *       *   d    *    i   *       ->           *    f     *
   *     __|__    __|__    __|__                __|__      __|___
   *    |  |  |  |  |  |  |  |  |              |  |  |    |  |   |
   *    a  b  c  e  g  h  j  k  l              *  d  *    *  i   *
   *                                         __|__   |   _|_   __|__
   *                                        |  |  |  |  |   | |  |  |
   *                                        a  b  c  e  g   h j  k  l
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
    let mst = await MST.create(blockstore)
    const cid = await util.randomCid()
    for (const tid of layer0) {
      mst = await mst.add(tid, cid)
    }
    for (const tid of layer1) {
      mst = await mst.add(tid, cid)
    }
    mst = await mst.add(layer2, cid)
    const layer = await mst.getLayer()
    expect(layer).toBe(2)

    const allTids = [...layer0, ...layer1, layer2]
    for (const tid of allTids) {
      const got = await mst.get(tid)
      expect(cid.equals(got)).toBeTruthy()
    }
  })
  /**
   *   `b` gets added & it hashes to 2 levels above any existing laves
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
    const layer0 = ['3j6hnk65jis2t', '3j6hnk65kvz2t']
    const layer1 = ['3j6hnk65jju2t', '3j6hnk65l222t']
    const layer2 = '3j6hnk65jng2t'
    const blockstore = IpldStore.createInMemory()
    let mst = await MST.create(blockstore)
    const cid = await util.randomCid()
    for (const tid of layer0) {
      mst = await mst.add(tid, cid)
    }
    mst = await mst.add(layer2, cid)
    for (const tid of layer1) {
      mst = await mst.add(tid, cid)
    }

    const layer = await mst.getLayer()
    expect(layer).toBe(2)
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
