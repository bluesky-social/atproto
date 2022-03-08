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

test('syncs a repo that is starting from scratch', async (t) => {
  const { storeAlice, storeBob, programName } = t.context as Context

  const data = await util.fillUserStore(storeAlice, programName, 10, 10)
  const diff = await storeAlice.getDiffCar(storeBob.cid)
  await storeBob.loadCar(diff)
  await util.checkUserStore(t, storeBob, programName, data)
})

test('syncs a repo that is behind', async (t) => {
  const { storeAlice, storeBob, programName } = t.context as Context

  const data = await util.fillUserStore(storeAlice, programName, 10, 10)
  const diff = await storeAlice.getDiffCar(storeBob.cid)
  await storeBob.loadCar(diff)

  const data2 = await util.fillUserStore(storeAlice, programName, 10, 10)
  const diff2 = await storeAlice.getDiffCar(storeBob.cid)
  await storeBob.loadCar(diff2)

  const allData = {
    posts: {
      ...data.posts,
      ...data2.posts,
    },
    interactions: {
      ...data.interactions,
      ...data2.interactions,
    },
  }

  await util.checkUserStore(t, storeBob, programName, allData)
})

test('syncs a non-historical copy of a repo', async (t) => {
  const { storeAlice, programName } = t.context as Context
  const data = await util.fillUserStore(storeAlice, programName, 20, 20)
  const car = await storeAlice.getCarFile()

  const ipld = IpldStore.createInMemory()
  const storeBob = await UserStore.fromCarFile(car, ipld)

  await util.checkUserStore(t, storeBob, programName, data)
})
