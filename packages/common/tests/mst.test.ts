import TID from '../src/repo/tid'
import MST, { leadingZerosOnHash } from '../src/repo/mst'
import * as uint8arrays from 'uint8arrays'

import * as util from './_util'
import { sha256 } from '@adxp/crypto'
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
