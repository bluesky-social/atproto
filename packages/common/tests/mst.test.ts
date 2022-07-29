import MST from '../src/repo/mst/mst'

import * as util from './_util'
import { IpldStore } from '../src'
import { CID } from 'multiformats'
import fs from 'fs'

describe('Merkle Search Tree', () => {
  let blockstore: IpldStore
  let mst: MST
  let mapping: Record<string, CID>
  let shuffled: [string, CID][]

  beforeAll(async () => {
    blockstore = IpldStore.createInMemory()
    mst = await MST.create(blockstore)
    mapping = await util.generateBulkTidMapping(1000)
    shuffled = shuffle(Object.entries(mapping))
  })

  it('adds records', async () => {
    for (const entry of shuffled) {
      mst = await mst.add(entry[0], entry[1])
    }
    for (const entry of shuffled) {
      const got = await mst.get(entry[0])
      expect(entry[1].equals(got)).toBeTruthy()
    }

    const totalSize = await mst.leafCount()
    expect(totalSize).toBe(1000)
  })

  it('edits records', async () => {
    let editedMst = mst
    const toEdit = shuffled.slice(0, 100)

    const edited: [string, CID][] = []
    for (const entry of toEdit) {
      const newCid = await util.randomCid()
      editedMst = await editedMst.edit(entry[0], newCid)
      edited.push([entry[0], newCid])
    }

    for (const entry of edited) {
      const got = await editedMst.get(entry[0])
      expect(entry[1].equals(got)).toBeTruthy()
    }

    const totalSize = await editedMst.leafCount()
    expect(totalSize).toBe(1000)
  })

  it('deletes records', async () => {
    let deletedMst = mst
    const toDelete = shuffled.slice(0, 100)
    const theRest = shuffled.slice(100)
    for (const entry of toDelete) {
      deletedMst = await deletedMst.delete(entry[0])
    }

    const totalSize = await deletedMst.leafCount()
    expect(totalSize).toBe(900)

    for (const entry of toDelete) {
      const got = await deletedMst.get(entry[0])
      expect(got).toBe(null)
    }
    for (const entry of theRest) {
      const got = await deletedMst.get(entry[0])
      expect(entry[1].equals(got)).toBeTruthy()
    }
  })

  it('is order independent', async () => {
    const allNodes = await mst.allNodes()

    let recreated = await MST.create(blockstore)
    const reshuffled = shuffle(Object.entries(mapping))
    for (const entry of reshuffled) {
      recreated = await recreated.add(entry[0], entry[1])
    }
    const allReshuffled = await recreated.allNodes()

    expect(allNodes.length).toBe(allReshuffled.length)
    for (let i = 0; i < allNodes.length; i++) {
      expect(allNodes[i].equals(allReshuffled[i])).toBeTruthy()
    }
  })

  it('saves and loads from blockstore', async () => {
    const cid = await mst.save()
    const loaded = await MST.fromCid(blockstore, cid)
    const origNodes = await mst.allNodes()
    const loadedNodes = await loaded.allNodes()
    expect(origNodes.length).toBe(loadedNodes.length)
    for (let i = 0; i < origNodes.length; i++) {
      expect(origNodes[i].equals(loadedNodes[i])).toBeTruthy()
    }
  })

  return
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
  for await (const entry of tree.walk()) {
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
  }
  fs.writeFileSync(filename, log)
}
