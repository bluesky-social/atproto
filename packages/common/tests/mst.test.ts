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
    const cid = await util.randomCid()

    for (let i = 0; i < 1000; i++) {
      const tid = TID.next()
      await mst.set(tid.toString(), cid)
    }
    console.log('zeroes: ', mst.zeros)
    // await mst.set('1', cid)
    // await mst.set('2', cid)
    // await mst.set('3', cid)
    // await mst.set('4', cid)
    // await mst.set('5', cid)
    // await mst.set('3j6ezmyjtgm2n', cid)
    // await mst.set('6', cid)
    // await mst.set('7', cid)
    // await mst.set('8', cid)
    // await mst.set('9', cid)
    // await mst.set('10', cid)
    // await mst.set('11', cid)
    // await mst.set('12', cid)
    // await mst.set('13', cid)
    // await mst.set('14', cid)
    // await mst.set('15', cid)
    // await mst.set('16', cid)
    // await mst.set('17', cid)
    // await mst.set('18', cid)
    // await mst.set('19', cid)
    // await mst.set('20', cid)
    // await mst.set('21', cid)
    // await mst.set('22', cid)
    // await mst.set('23', cid)
    // await mst.set('24', cid)
    // await mst.set('25', cid)
    // await mst.set('26', cid)
    // await mst.set('27', cid)
    // await mst.set('28', cid)
    // await mst.set('29', cid)
    // await mst.set('30', cid)
  })
  // it('blah', async () => {
  //   let counts = {
  //     0: 0,
  //     1: 0,
  //     2: 0,
  //     3: 0,
  //     4: 0,
  //     5: 0,
  //     6: 0,
  //   }
  //   for (let i = 0; i < 1000000; i++) {
  //     const tid = TID.next()
  //     const count = await leadingZerosOnHash(tid.toString())
  //     counts[count]++
  //   }
  //   console.log(counts)
  // })
  // it('does something', async () => {
  //   const mst = new MST()
  //   const cid = await util.randomCid()
  //   for (let i = 0; i < 256; i++) {
  //     const tid = TID.next()
  //     await mst.set(tid.toString(), cid)
  //   }
  // })
})
