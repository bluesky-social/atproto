import { MST } from '../src/mst'
import DataDiff, { DataAdd, DataUpdate, DataDelete } from '../src/data-diff'
import { countPrefixLen, InvalidMstKeyError } from '../src/mst/util'

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
    mapping = await util.generateBulkDataKeys(1000, blockstore)
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
      await util.generateBulkDataKeys(100, blockstore),
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
      const found =
        (await blockstore.has(cid)) ||
        diff.newMstBlocks.has(cid) ||
        diff.newLeafCids.has(cid)
      expect(found).toBeTruthy()
    }
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
  })

  describe('MST Interop Allowable Keys', () => {
    let blockstore: MemoryBlockstore
    let mst: MST
    let cid1: CID

    beforeAll(async () => {
      blockstore = new MemoryBlockstore()
      mst = await MST.create(blockstore)
      cid1 = CID.parse(
        'bafyreie5cvv4h45feadgeuwhbcutmh6t2ceseocckahdoe6uat64zmz454',
      )
    })

    const expectReject = async (key: string) => {
      const promise = mst.add(key, cid1)
      await expect(promise).rejects.toThrow(InvalidMstKeyError)
    }

    it('rejects the empty key', async () => {
      await expectReject('')
    })

    it('rejects a key with no collection', async () => {
      await expectReject('asdf')
    })

    it('rejects a key with a nested collection', async () => {
      await expectReject('nested/collection/asdf')
    })

    it('rejects on empty coll or rkey', async () => {
      await expectReject('coll/')
      await expectReject('/rkey')
    })

    it('rejects non-ascii chars', async () => {
      await expectReject('coll/jalapeñoA')
      await expectReject('coll/coöperative')
      await expectReject('coll/abc💩')
    })

    it('rejects ascii that we dont support', async () => {
      await expectReject('coll/key$')
      await expectReject('coll/key%')
      await expectReject('coll/key(')
      await expectReject('coll/key)')
      await expectReject('coll/key+')
      await expectReject('coll/key=')
    })

    it('rejects keys over 256 chars', async () => {
      await expectReject(
        'coll/asdofiupoiwqeurfpaosidfuapsodirupasoirupasoeiruaspeoriuaspeoriu2p3o4iu1pqw3oiuaspdfoiuaspdfoiuasdfpoiasdufpwoieruapsdofiuaspdfoiuasdpfoiausdfpoasidfupasodifuaspdofiuasdpfoiasudfpoasidfuapsodfiuasdpfoiausdfpoasidufpasodifuapsdofiuasdpofiuasdfpoaisdufpao',
      )
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
      mst = await mst.add('com.example.record/3jqfcqzm3fo2j', cid1)
      expect(await mst.leafCount()).toBe(1)
      expect((await mst.getPointer()).toString()).toBe(
        'bafyreibj4lsc3aqnrvphp5xmrnfoorvru4wynt6lwidqbm2623a6tatzdu',
      )
    })

    it('computes "singlelayer2" tree root CID', async () => {
      mst = await mst.add('com.example.record/3jqfcqzm3fx2j', cid1)
      expect(await mst.leafCount()).toBe(1)
      expect(await mst.layer).toBe(2)
      expect((await mst.getPointer()).toString()).toBe(
        'bafyreih7wfei65pxzhauoibu3ls7jgmkju4bspy4t2ha2qdjnzqvoy33ai',
      )
    })

    it('computes "simple" tree root CID', async () => {
      mst = await mst.add('com.example.record/3jqfcqzm3fp2j', cid1) // level 0
      mst = await mst.add('com.example.record/3jqfcqzm3fr2j', cid1) // level 0
      mst = await mst.add('com.example.record/3jqfcqzm3fs2j', cid1) // level 1
      mst = await mst.add('com.example.record/3jqfcqzm3ft2j', cid1) // level 0
      mst = await mst.add('com.example.record/3jqfcqzm4fc2j', cid1) // level 0
      expect(await mst.leafCount()).toBe(5)
      expect((await mst.getPointer()).toString()).toBe(
        'bafyreicmahysq4n6wfuxo522m6dpiy7z7qzym3dzs756t5n7nfdgccwq7m',
      )
    })
  })

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
      const l1root =
        'bafyreifnqrwbk6ffmyaz5qtujqrzf5qmxf7cbxvgzktl4e3gabuxbtatv4'
      const l0root =
        'bafyreie4kjuxbwkhzg2i5dljaswcroeih4dgiqq6pazcmunwt2byd725vi'

      mst = await mst.add('com.example.record/3jqfcqzm3fn2j', cid1) // level 0
      mst = await mst.add('com.example.record/3jqfcqzm3fo2j', cid1) // level 0
      mst = await mst.add('com.example.record/3jqfcqzm3fp2j', cid1) // level 0
      mst = await mst.add('com.example.record/3jqfcqzm3fs2j', cid1) // level 1
      mst = await mst.add('com.example.record/3jqfcqzm3ft2j', cid1) // level 0
      mst = await mst.add('com.example.record/3jqfcqzm3fu2j', cid1) // level 0

      expect(await mst.leafCount()).toBe(6)
      expect(await mst.layer).toBe(1)
      expect((await mst.getPointer()).toString()).toBe(l1root)

      mst = await mst.delete('com.example.record/3jqfcqzm3fs2j') // level 1
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
      const l1root =
        'bafyreiettyludka6fpgp33stwxfuwhkzlur6chs4d2v4nkmq2j3ogpdjem'
      const l2root =
        'bafyreid2x5eqs4w4qxvc5jiwda4cien3gw2q6cshofxwnvv7iucrmfohpm'

      mst = await mst.add('com.example.record/3jqfcqzm3fo2j', cid1) // A; level 0
      mst = await mst.add('com.example.record/3jqfcqzm3fp2j', cid1) // B; level 0
      mst = await mst.add('com.example.record/3jqfcqzm3fr2j', cid1) // C; level 0
      mst = await mst.add('com.example.record/3jqfcqzm3fs2j', cid1) // D; level 1
      mst = await mst.add('com.example.record/3jqfcqzm3ft2j', cid1) // E; level 0
      // GAP for F
      mst = await mst.add('com.example.record/3jqfcqzm3fz2j', cid1) // G; level 0
      mst = await mst.add('com.example.record/3jqfcqzm4fc2j', cid1) // H; level 0
      mst = await mst.add('com.example.record/3jqfcqzm4fd2j', cid1) // I; level 1
      mst = await mst.add('com.example.record/3jqfcqzm4ff2j', cid1) // J; level 0
      mst = await mst.add('com.example.record/3jqfcqzm4fg2j', cid1) // K; level 0
      mst = await mst.add('com.example.record/3jqfcqzm4fh2j', cid1) // L; level 0

      expect(await mst.leafCount()).toBe(11)
      expect(await mst.layer).toBe(1)
      expect((await mst.getPointer()).toString()).toBe(l1root)

      // insert F, which will push E out of the node with G+H to a new node under D
      mst = await mst.add('com.example.record/3jqfcqzm3fx2j', cid1) // F; level 2
      expect(await mst.leafCount()).toBe(12)
      expect(await mst.layer).toBe(2)
      expect((await mst.getPointer()).toString()).toBe(l2root)

      // remove F, which should push E back over with G+H
      mst = await mst.delete('com.example.record/3jqfcqzm3fx2j') // F; level 2
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
      const l0root =
        'bafyreidfcktqnfmykz2ps3dbul35pepleq7kvv526g47xahuz3rqtptmky'
      const l2root =
        'bafyreiavxaxdz7o7rbvr3zg2liox2yww46t7g6hkehx4i4h3lwudly7dhy'
      const l2root2 =
        'bafyreig4jv3vuajbsybhyvb7gggvpwh2zszwfyttjrj6qwvcsp24h6popu'

      mst = await mst.add('com.example.record/3jqfcqzm3ft2j', cid1) // A; level 0
      mst = await mst.add('com.example.record/3jqfcqzm3fz2j', cid1) // C; level 0
      expect(await mst.leafCount()).toBe(2)
      expect(await mst.layer).toBe(0)
      expect((await mst.getPointer()).toString()).toBe(l0root)

      // insert B, which is two levels above
      mst = await mst.add('com.example.record/3jqfcqzm3fx2j', cid1) // B; level 2
      expect(await mst.leafCount()).toBe(3)
      expect(await mst.layer).toBe(2)
      expect((await mst.getPointer()).toString()).toBe(l2root)

      // remove B
      mst = await mst.delete('com.example.record/3jqfcqzm3fx2j') // B; level 2
      expect(await mst.leafCount()).toBe(2)
      expect(await mst.layer).toBe(0)
      expect((await mst.getPointer()).toString()).toBe(l0root)

      // insert B (level=2) and D (level=1)
      mst = await mst.add('com.example.record/3jqfcqzm3fx2j', cid1) // B; level 2
      mst = await mst.add('com.example.record/3jqfcqzm4fd2j', cid1) // D; level 1
      expect(await mst.leafCount()).toBe(4)
      expect(await mst.layer).toBe(2)
      expect((await mst.getPointer()).toString()).toBe(l2root2)

      // remove D
      mst = await mst.delete('com.example.record/3jqfcqzm4fd2j') // D; level 1
      expect(await mst.leafCount()).toBe(3)
      expect(await mst.layer).toBe(2)
      expect((await mst.getPointer()).toString()).toBe(l2root)
    })
  })
})
