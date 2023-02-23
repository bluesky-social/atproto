import { MST } from '../src/mst'
import DataDiff, { DataAdd, DataUpdate, DataDelete } from '../src/data-diff'
import { countPrefixLen, leadingZerosOnHash } from '../src/mst/util'

import { MemoryBlockstore } from '../src/storage'
import * as util from './_util'

import { CID } from 'multiformats'

describe('Merkle Search Tree', () => {
  let blockstore: MemoryBlockstore
  let mst: MST
  let mapping: Record<string, CID>
  let shuffled: [string, CID][]

  beforeAll(async () => {
    blockstore = new MemoryBlockstore()
    mst = await MST.create(blockstore)
    mapping = await util.generateBulkTidMapping(1000, blockstore)
    shuffled = util.shuffle(Object.entries(mapping))
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
      editedMst = await editedMst.update(entry[0], newCid)
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
    const reshuffled = util.shuffle(Object.entries(mapping))
    for (const entry of reshuffled) {
      recreated = await recreated.add(entry[0], entry[1])
    }
    const allReshuffled = await recreated.allNodes()

    expect(allNodes.length).toBe(allReshuffled.length)
    for (let i = 0; i < allNodes.length; i++) {
      expect(await allNodes[i].equals(allReshuffled[i])).toBeTruthy()
    }
  })

  it('saves and loads from blockstore', async () => {
    const root = await util.saveMst(blockstore, mst)
    const loaded = await MST.load(blockstore, root)
    const origNodes = await mst.allNodes()
    const loadedNodes = await loaded.allNodes()
    expect(origNodes.length).toBe(loadedNodes.length)
    for (let i = 0; i < origNodes.length; i++) {
      expect(await origNodes[i].equals(loadedNodes[i])).toBeTruthy()
    }
  })

  it('diffs', async () => {
    let toDiff = mst

    const toAdd = Object.entries(
      await util.generateBulkTidMapping(100, blockstore),
    )
    const toEdit = shuffled.slice(500, 600)
    const toDel = shuffled.slice(400, 500)

    const expectedAdds: Record<string, DataAdd> = {}
    const expectedUpdates: Record<string, DataUpdate> = {}
    const expectedDels: Record<string, DataDelete> = {}

    for (const entry of toAdd) {
      toDiff = await toDiff.add(entry[0], entry[1])
      expectedAdds[entry[0]] = { key: entry[0], cid: entry[1] }
    }
    for (const entry of toEdit) {
      const updated = await util.randomCid()
      toDiff = await toDiff.update(entry[0], updated)
      expectedUpdates[entry[0]] = {
        key: entry[0],
        prev: entry[1],
        cid: updated,
      }
    }
    for (const entry of toDel) {
      toDiff = await toDiff.delete(entry[0])
      expectedDels[entry[0]] = { key: entry[0], cid: entry[1] }
    }

    const diff = await DataDiff.of(toDiff, mst)

    expect(diff.addList().length).toBe(100)
    expect(diff.updateList().length).toBe(100)
    expect(diff.deleteList().length).toBe(100)

    expect(diff.adds).toEqual(expectedAdds)
    expect(diff.updates).toEqual(expectedUpdates)
    expect(diff.deletes).toEqual(expectedDels)

    // ensure we correctly report all added CIDs
    for await (const entry of toDiff.walk()) {
      let cid: CID
      if (entry.isTree()) {
        cid = await entry.getPointer()
      } else {
        cid = entry.value
      }
      const found = (await blockstore.has(cid)) || diff.newCids.has(cid)
      expect(found).toBeTruthy()
    }
  })

  // Special Cases (these are made for fanout 32)
  // ------------

  it('trims the top of an MST on stage', async () => {
    const layer0 = [
      '3j6hnk65jis2t',
      '3j6hnk65jit2t',
      '3j6hnk65jiu2t',
      '3j6hnk65jne2t',
      '3j6hnk65jnm2t',
    ]
    const layer1 = '3j6hnk65jju2t'
    mst = await MST.create(blockstore, [], { fanout: 32 })
    const cid = await util.randomCid()
    const tids = [...layer0, layer1]
    for (const tid of tids) {
      mst = await mst.add(tid, cid)
    }
    const layer = await mst.getLayer()
    expect(layer).toBe(1)
    mst = await mst.delete(layer1)
    const root = await util.saveMst(blockstore, mst)
    const loaded = MST.load(blockstore, root)
    const loadedLayer = await loaded.getLayer()
    expect(loadedLayer).toBe(0)
  })

  // These are some tricky things that can come up that may not be included in a randomized tree

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
    mst = await MST.create(blockstore, [], { fanout: 32 })
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

    const root = await util.saveMst(blockstore, mst)
    mst = MST.load(blockstore, root, { fanout: 32 })

    const allTids = [...layer0, ...layer1, layer2]
    for (const tid of allTids) {
      const got = await mst.get(tid)
      expect(cid.equals(got)).toBeTruthy()
    }
  })
  /**
   *   `b` gets added & it hashes to 2 levels above any existing leaves
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
    const layer2 = '3j6hnk65jng2t'
    mst = await MST.create(blockstore, [], { fanout: 32 })
    const cid = await util.randomCid()
    for (const tid of layer0) {
      mst = await mst.add(tid, cid)
    }
    mst = await mst.add(layer2, cid)

    const root = await util.saveMst(blockstore, mst)
    mst = MST.load(blockstore, root, { fanout: 32 })

    const layer = await mst.getLayer()
    expect(layer).toBe(2)
    const allTids = [...layer0, layer2]
    for (const tid of allTids) {
      const got = await mst.get(tid)
      expect(cid.equals(got)).toBeTruthy()
    }
  })
})

describe('utils', () => {
  it('counts prefix length', () => {
    expect(countPrefixLen('abc', 'abc')).toBe(3)
    expect(countPrefixLen('', 'abc')).toBe(0)
    expect(countPrefixLen('abc', '')).toBe(0)
    expect(countPrefixLen('ab', 'abc')).toBe(2)
    expect(countPrefixLen('abc', 'ab')).toBe(2)
    expect(countPrefixLen('abcde', 'abc')).toBe(3)
    expect(countPrefixLen('abc', 'abcde')).toBe(3)
    expect(countPrefixLen('abcde', 'abc1')).toBe(3)
    expect(countPrefixLen('abcde', 'abb')).toBe(2)
    expect(countPrefixLen('abcde', 'qbb')).toBe(0)
    expect(countPrefixLen('', 'asdf')).toBe(0)
    expect(countPrefixLen('abc', 'abc\x00')).toBe(3)
    expect(countPrefixLen('abc\x00', 'abc')).toBe(3)
  })

  it('counts string (not byte) prefix length', () => {
    // @TODO: these are not cross-language consistent
    expect('jalapeño'.length).toBe(8)
    expect('💩'.length).toBe(2)
    expect('👩‍👧‍👧'.length).toBe(8)
    expect(countPrefixLen('jalapeño', 'jalapeno')).toBe(6)
    expect(countPrefixLen('jalapeñoA', 'jalapeñoB')).toBe(8)
    expect(countPrefixLen('coöperative', 'coüperative')).toBe(2)
    expect(countPrefixLen('abc💩abc', 'abcabc')).toBe(3)
    // these are a bit unintuitive
    expect(countPrefixLen('💩abc', '💩ab')).toBe(4)
    expect(countPrefixLen('abc👩‍👧‍👧de', 'abc👩‍👦‍👦')).toBe(7)
  })

  it.skip('counts byte (not string) prefix length', () => {
    expect(countPrefixLen('jalapeño', 'jalapeno')).toBe(6)
    expect(countPrefixLen('jalapeñoA', 'jalapeñoB')).toBe(8)
    expect(countPrefixLen('coöperative', 'coüperative')).toBe(3)

    expect(countPrefixLen('jalapeño', 'jalapeno')).toBe(6)
    expect(countPrefixLen('jalapeñoA', 'jalapeñoB')).toBe(8)
    expect(countPrefixLen('coöperative', 'coüperative')).toBe(3)
    expect(countPrefixLen('abc💩abc', 'abcabc')).toBe(3)
    expect(countPrefixLen('💩abc', '💩ab')).toBe(6)
    expect(countPrefixLen('abc👩‍👧‍👧de', 'abc👩‍👦‍👦')).toBe(11)
  })

  it('computes leading zeros', async () => {
    const fo = 16
    expect(await leadingZerosOnHash('', fo)).toBe(0)
    expect(await leadingZerosOnHash('asdf', fo)).toBe(0)
    expect(await leadingZerosOnHash('2653ae71', fo)).toBe(0)
    expect(await leadingZerosOnHash('88bfafc7', fo)).toBe(1)
    expect(await leadingZerosOnHash('2a92d355', fo)).toBe(2)
    expect(await leadingZerosOnHash('884976f5', fo)).toBe(3)
    expect(
      await leadingZerosOnHash('app.bsky.feed.post/454397e440ec', fo),
    ).toBe(2)
    expect(
      await leadingZerosOnHash('app.bsky.feed.post/9adeb165882c', fo),
    ).toBe(4)
  })
})

describe('MST Interop Known Maps', () => {
  let blockstore: MemoryBlockstore
  let mst: MST
  let cid1: CID

  beforeAll(async () => {
    blockstore = new MemoryBlockstore()
    cid1 = CID.parse(
      'bafyreie5cvv4h45feadgeuwhbcutmh6t2ceseocckahdoe6uat64zmz454',
    )
  })

  beforeEach(async () => {
    mst = await MST.create(blockstore)
  })

  it('computes "empty" tree root CID', async () => {
    expect(await mst.leafCount()).toBe(0)
    expect((await mst.getPointer()).toString()).toBe(
      'bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm',
    )
  })

  it('computes "trivial" tree root CID', async () => {
    mst = await mst.add('asdf', cid1)
    expect(await mst.leafCount()).toBe(1)
    expect((await mst.getPointer()).toString()).toBe(
      'bafyreidaftbr35xhh4lzmv5jcoeufqjh75ohzmz6u56v7n2ippbtxdgqqe',
    )
  })

  it('computes "singlelayer2" tree root CID', async () => {
    mst = await mst.add('com.example.record/9ba1c7247ede', cid1)
    expect(await mst.leafCount()).toBe(1)
    expect(await mst.layer).toBe(2)
    expect((await mst.getPointer()).toString()).toBe(
      'bafyreid4g5smj6ukhrjasebt6myj7wmtm2eijouteoyueoqgoh6vm5jkae',
    )
  })

  it('computes "simple" tree root CID', async () => {
    mst = await mst.add('asdf', cid1)
    mst = await mst.add('88bfafc7', cid1)
    mst = await mst.add('2a92d355', cid1)
    mst = await mst.add('app.bsky.feed.post/454397e440ec', cid1)
    mst = await mst.add('app.bsky.feed.post/9adeb165882c', cid1)
    expect(await mst.leafCount()).toBe(5)
    expect((await mst.getPointer()).toString()).toBe(
      'bafyreiecb33zh7r2sc3k2wthm6exwzfktof63kmajeildktqc25xj6qzx4',
    )
  })

  it('computes "tricky" tree root CID', async () => {
    mst = await mst.add('asdf', cid1)
    mst = await mst.add('88bfafc7', cid1)
    mst = await mst.add('2a92d355', cid1)
    mst = await mst.add('app.bsky.feed.post/454397e440ec', cid1)
    mst = await mst.add('app.bsky.feed.post/9adeb165882c', cid1)
    expect(await mst.leafCount()).toBe(5)
    expect((await mst.getPointer()).toString()).toBe(
      'bafyreiecb33zh7r2sc3k2wthm6exwzfktof63kmajeildktqc25xj6qzx4',
    )
  })
})

// ported from fanout=32 versions above
describe('MST Interop Edge Cases', () => {
  let blockstore: MemoryBlockstore
  let mst: MST
  let cid1: CID

  beforeAll(async () => {
    blockstore = new MemoryBlockstore()
    cid1 = CID.parse(
      'bafyreie5cvv4h45feadgeuwhbcutmh6t2ceseocckahdoe6uat64zmz454',
    )
  })

  beforeEach(async () => {
    mst = await MST.create(blockstore)
  })

  it('trims top of tree on delete', async () => {
    const l1root = 'bafyreihuyj2vzb2vjw3yhxg6dy25achg5fmre6gg5m6fjtxn64bqju4dee'
    const l0root = 'bafyreibmijjc63mekkjzl3v2pegngwke5u6cu66g75z6uw27v64bc6ahqi'

    mst = await mst.add('com.example.record/40c73105b48f', cid1) // level 0
    mst = await mst.add('com.example.record/e99bf3ced34b', cid1) // level 0
    mst = await mst.add('com.example.record/893e6c08b450', cid1) // level 0
    mst = await mst.add('com.example.record/9cd8b6c0cc02', cid1) // level 0
    mst = await mst.add('com.example.record/cbe72d33d12a', cid1) // level 0
    mst = await mst.add('com.example.record/a15e33ba0f6c', cid1) // level 1
    expect(await mst.leafCount()).toBe(6)
    expect(await mst.layer).toBe(1)
    expect((await mst.getPointer()).toString()).toBe(l1root)

    mst = await mst.delete('com.example.record/a15e33ba0f6c') // level 1
    expect(await mst.leafCount()).toBe(5)
    expect(await mst.layer).toBe(0)
    expect((await mst.getPointer()).toString()).toBe(l0root)
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
   *                                        |  |  |  |  |   | |  |  |
   *                                        a  b  c  e  g   h j  k  l
   *
   */
  it('handles insertion that splits two layers down', async () => {
    const l1root = 'bafyreiagt55jzvkenoa4yik77dhomagq2uj26ix4cijj7kd2py2u3s43ve'
    const l2root = 'bafyreiddrz7qbvfattp5dzzh4ldohsaobatsg7f5l6awxnmuydewq66qoa'

    mst = await mst.add('com.example.record/403e2aeebfdb', cid1) // A; level 0
    mst = await mst.add('com.example.record/40c73105b48f', cid1) // B; level 0
    mst = await mst.add('com.example.record/645787eb4316', cid1) // C; level 0
    mst = await mst.add('com.example.record/7ca4e61d6fbc', cid1) // D; level 1
    mst = await mst.add('com.example.record/893e6c08b450', cid1) // E; level 0
    // GAP for F
    mst = await mst.add('com.example.record/9cd8b6c0cc02', cid1) // G; level 0
    mst = await mst.add('com.example.record/cbe72d33d12a', cid1) // H; level 0
    mst = await mst.add('com.example.record/dbea731be795', cid1) // I; level 1
    mst = await mst.add('com.example.record/e2ef555433f2', cid1) // J; level 0
    mst = await mst.add('com.example.record/e99bf3ced34b', cid1) // K; level 0
    mst = await mst.add('com.example.record/f728ba61e4b6', cid1) // L; level 0
    expect(await mst.leafCount()).toBe(11)
    expect(await mst.layer).toBe(1)
    expect((await mst.getPointer()).toString()).toBe(l1root)

    // insert F, which will push E out of the node with G+H to a new node under D
    mst = await mst.add('com.example.record/9ba1c7247ede', cid1) // F; level 2
    expect(await mst.leafCount()).toBe(12)
    expect(await mst.layer).toBe(2)
    expect((await mst.getPointer()).toString()).toBe(l2root)

    // remove F, which should push E back over with G+H
    mst = await mst.delete('com.example.record/9ba1c7247ede') // F; level 2
    expect(await mst.leafCount()).toBe(11)
    expect(await mst.layer).toBe(1)
    expect((await mst.getPointer()).toString()).toBe(l1root)
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
    const l0root = 'bafyreicivoa3p3ttcebdn2zfkdzenkd2uk3gxxlaz43qvueeip6yysvq2m'
    const l2root = 'bafyreidwoqm6xlewxzhrx6ytbyhsazctlv72txtmnd4au6t53z2vpzn7wa'
    const l2root2 =
      'bafyreiapru27ce4wdlylk5revtr3hewmxhmt3ek5f2ypioiivmdbv5igrm'

    mst = await mst.add('com.example.record/403e2aeebfdb', cid1) // A; level 0
    mst = await mst.add('com.example.record/cbe72d33d12a', cid1) // C; level 0
    expect(await mst.leafCount()).toBe(2)
    expect(await mst.layer).toBe(0)
    expect((await mst.getPointer()).toString()).toBe(l0root)

    // insert B, which is two levels above
    mst = await mst.add('com.example.record/9ba1c7247ede', cid1) // B; level 2
    expect(await mst.leafCount()).toBe(3)
    expect(await mst.layer).toBe(2)
    expect((await mst.getPointer()).toString()).toBe(l2root)

    // remove B
    mst = await mst.delete('com.example.record/9ba1c7247ede') // B; level 2
    expect(await mst.leafCount()).toBe(2)
    expect(await mst.layer).toBe(0)
    expect((await mst.getPointer()).toString()).toBe(l0root)

    // insert B (level=2) and D (level=1)
    mst = await mst.add('com.example.record/9ba1c7247ede', cid1) // B; level 2
    mst = await mst.add('com.example.record/fae7a851fbeb', cid1) // D; level 1
    expect(await mst.leafCount()).toBe(4)
    expect(await mst.layer).toBe(2)
    expect((await mst.getPointer()).toString()).toBe(l2root2)

    // remove D
    mst = await mst.delete('com.example.record/fae7a851fbeb') // D; level 1
    expect(await mst.leafCount()).toBe(3)
    expect(await mst.layer).toBe(2)
    expect((await mst.getPointer()).toString()).toBe(l2root)
  })
})
