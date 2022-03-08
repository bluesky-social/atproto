import test from 'ava'

import * as ucan from 'ucans'

import UserStore from '../src/user-store/index.js'
import IpldStore from '../src/blockstore/ipld-store.js'

import * as check from '../src/common/type-check.js'
import * as util from './_util.js'
import TID from '../src/user-store/tid.js'

type Context = {
  ipldAlice: IpldStore
  keypairAlice: ucan.EdKeypair
  storeAlice: UserStore
  ipldBob: IpldStore
  keypairBob: ucan.EdKeypair
  storeBob: UserStore
  programName: string
}

test.beforeEach(async (t) => {
  const ipldAlice = IpldStore.createInMemory()
  const keypairAlice = await ucan.EdKeypair.create()
  const storeAlice = await UserStore.create(ipldAlice, keypairAlice)

  const ipldBob = IpldStore.createInMemory()
  const keypairBob = await ucan.EdKeypair.create()
  const storeBob = await UserStore.create(ipldBob, keypairBob)

  const programName = 'did:bsky:test'
  t.context = {
    ipldAlice,
    keypairAlice,
    storeAlice,
    ipldBob,
    keypairBob,
    storeBob,
    programName,
  } as Context
  t.pass('Context setup')
})

test('syncs a repo that is behind', async (t) => {
  const { storeAlice, storeBob, programName } = t.context as Context

  const data = await util.fillUserStore(storeAlice, programName, 10, 10)
  const diff = await storeAlice.getDiffCar(storeBob.cid)
  await storeBob.loadCar(diff)

  await storeBob.runOnProgram(programName, async (program) => {
    for (const tid of Object.keys(data.posts)) {
      const cid = await program.posts.getEntry(TID.fromStr(tid))
      const actual = cid ? await storeBob.get(cid, check.assureString) : null
      t.deepEqual(
        actual,
        data.posts[tid],
        `Matching post content for tid: ${tid}`,
      )
    }
    for (const tid of Object.keys(data.interactions)) {
      const cid = await program.interactions.getEntry(TID.fromStr(tid))
      const actual = cid ? await storeBob.get(cid, check.assureString) : null
      t.deepEqual(
        actual,
        data.interactions[tid],
        `Matching post content for tid: ${tid}`,
      )
    }
  })
})
