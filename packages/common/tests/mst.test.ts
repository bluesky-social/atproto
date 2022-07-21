import TID from '../src/repo/tid'
import MST, { leadingZerosOnHash } from '../src/repo/mst'
import * as uint8arrays from 'uint8arrays'

import * as util from './_util'
import { sha256 } from '@adxp/crypto'

describe('Merkle Search Tree', () => {
  it('blah', async () => {
    let counts = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    }
    for (let i = 0; i < 1000000; i++) {
      const tid = TID.next()
      const count = await leadingZerosOnHash(tid.toString())
      counts[count]++
    }
    console.log(counts)
  })
  // it('does something', async () => {
  //   const mst = new MST()
  //   const cid = await util.randomCid()
  //   for (let i = 0; i < 256; i++) {
  //     const tid = TID.next()
  //     await mst.set(tid.toString(), cid)
  //   }
  // })
})
