import MST from '../src/repo/mst/mst'

import * as util from './_util'
import { IpldStore } from '../src'
import { CID } from 'multiformats'
import fs from 'fs'

describe('Merkle Search Tree', () => {
  it('saves and laods from blockstore', async () => {
    const blockstore = IpldStore.createInMemory()
    let mst = await MST.create(blockstore)
    const mapping = await util.generateBulkTidMapping(1000)
    const shuffled = shuffle(Object.entries(mapping))
    // Adds
    for (const entry of shuffled) {
      mst = await mst.add(entry[0], entry[1])
    }
    const cid = await mst.save()
    const loaded = await MST.fromCid(blockstore, cid)
    const origNodes = await mst.allNodes()
    const loadedNodes = await loaded.allNodes()
    expect(origNodes.length).toBe(loadedNodes.length)
    for (let i = 0; i < origNodes.length; i++) {
      expect(origNodes[i].equals(loadedNodes[i])).toBeTruthy()
    }
  })

  it('works', async () => {
    const blockstore = IpldStore.createInMemory()
    let mst = await MST.create(blockstore)
    const mapping = await util.generateBulkTidMapping(1000)
    const shuffled = shuffle(Object.entries(mapping))
    // Adds
    for (const entry of shuffled) {
      mst = await mst.add(entry[0], entry[1])
    }
    for (const entry of shuffled) {
      const got = await mst.get(entry[0])
      expect(entry[1].equals(got)).toBeTruthy()
    }

    await writeLog('walk-mst', mst)
    const leaves: Record<string, number> = {}
    await mst.walk((entry) => {
      if (entry.isLeaf()) {
        if (leaves[entry.key]) {
          leaves[entry.key]++
        } else {
          leaves[entry.key] = 1
        }
      }
      return true
    })

    let totalSize = await mst.entryCount()
    expect(totalSize).toBe(1000)

    // Edits
    const toEdit = shuffled.slice(0, 100)
    const edited: [string, CID][] = []
    for (const entry of toEdit) {
      const newCid = await util.randomCid()
      mst = await mst.edit(entry[0], newCid)
      edited.push([entry[0], newCid])
    }

    for (const entry of edited) {
      const got = await mst.get(entry[0])
      expect(entry[1].equals(got)).toBeTruthy()
    }

    totalSize = await mst.entryCount()
    expect(totalSize).toBe(1000)

    // Deletes
    const toDelete = toEdit
    const theRest = shuffled.slice(100)
    for (const entry of toDelete) {
      mst = await mst.delete(entry[0])
    }

    totalSize = await mst.entryCount()
    expect(totalSize).toBe(900)

    for (const entry of toDelete) {
      const got = await mst.get(entry[0])
      expect(got).toBe(null)
    }
    for (const entry of theRest) {
      const got = await mst.get(entry[0])
      expect(entry[1].equals(got)).toBeTruthy()
    }
  })

  it('diffs', async () => {
    const blockstore = IpldStore.createInMemory()
    let mst = await MST.create(blockstore)
    const mapping = await util.generateBulkTidMapping(1000)
    const shuffled = shuffle(Object.entries(mapping))
    // Adds
    for (const entry of shuffled) {
      mst = await mst.add(entry[0], entry[1])
    }
    const cid = await util.randomCid()

    const toDel = shuffled[550]
    const toEdit = shuffled[650]
    let toDiff = await mst.add('testing', cid)
    toDiff = await toDiff.delete(toDel[0])
    toDiff = await toDiff.edit(toEdit[0], cid)
    const entries = await mst.getEntries()
    const toDiffEntries = await toDiff.getEntries()
    console.log(mst)
    console.log(toDiff)
    const diff = await mst.diff(toDiff)
    console.log('DIFF: ', diff)
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

const writeLog = async (filename: string, tree: MST) => {
  let log = ''
  await tree.walk(async (entry) => {
    if (entry.isLeaf()) return true
    const layer = await entry.getLayer()
    log += `Layer ${layer}: ${entry.pointer}\n`
    log += '--------------\n'
    const entries = await entry.getEntries()
    for (const e of entries) {
      if (e.isLeaf()) {
        log += `Key: ${e.key}\n`
      } else {
        log += `Subtree: ${e.pointer}\n`
      }
    }
    log += '\n\n'
    return true
  })
  fs.writeFileSync(filename, log)
}
