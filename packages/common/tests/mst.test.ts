import MST from '../src/repo/mst'

import * as util from './_util'
import { IpldStore } from '../src'

describe('Merkle Search Tree', () => {
  it('works', async () => {
    const blockstore = IpldStore.createInMemory()
    const mst = await MST.create(blockstore)
    const mapping = await util.generateBulkTidMapping(1000)
    for (const entry of Object.entries(mapping)) {
      await mst.set(entry[0], entry[1])
    }

    for (const entry of Object.entries(mapping)) {
      const got = await mst.get(entry[0])
      expect(got).toEqual(entry[1])
    }
  })
})
