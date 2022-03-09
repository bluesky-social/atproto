import test from 'ava'

import * as ucan from 'ucans'

import UserStore from '../src/user-store/index.js'
import IpldStore from '../src/blockstore/ipld-store.js'

import * as util from './_util.js'

type Context = {
  ipldAlice: IpldStore
  keypairAlice: ucan.EdKeypair
  storeAlice: UserStore
  ipldBob: IpldStore
  keypairBob: ucan.EdKeypair
  programName: string
}

test.beforeEach(async (t) => {
  const ipldAlice = IpldStore.createInMemory()
  const keypairAlice = await ucan.EdKeypair.create()
  const storeAlice = await UserStore.create(ipldAlice, keypairAlice)

  const ipldBob = IpldStore.createInMemory()
  const keypairBob = await ucan.EdKeypair.create()

  const programName = 'did:bsky:test'
  t.context = {
    ipldAlice,
    keypairAlice,
    storeAlice,
    ipldBob,
    keypairBob,
    programName,
  } as Context
  t.pass('Context setup')
})

test('syncs an empty repo', async (t) => {
  const { storeAlice, ipldBob, keypairBob } = t.context as Context
  const car = await storeAlice.getFullHistory()
  const storeBob = await UserStore.fromCarFile(car, ipldBob, keypairBob)
  t.deepEqual(storeBob.programCids, {}, 'loads an empty repo')
})

test('syncs a repo that is starting from scratch', async (t) => {
  const { storeAlice, ipldBob, keypairBob, programName } = t.context as Context
  const data = await util.fillUserStore(storeAlice, programName, 150, 10)
  const car = await storeAlice.getFullHistory()
  const storeBob = await UserStore.fromCarFile(car, ipldBob, keypairBob)
  await util.checkUserStore(t, storeBob, programName, data)
})

test('syncs a repo that is behind', async (t) => {
  const { storeAlice, ipldBob, keypairBob, programName } = t.context as Context

  const data = await util.fillUserStore(storeAlice, programName, 150, 10)
  const car = await storeAlice.getFullHistory()
  const storeBob = await UserStore.fromCarFile(car, ipldBob, keypairBob)

  const data2 = await util.fillUserStore(storeAlice, programName, 300, 10)
  const diff = await storeAlice.getDiffCar(storeBob.cid)
  await storeBob.loadCar(diff)

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
  const data = await util.fillUserStore(storeAlice, programName, 150, 20)
  const car = await storeAlice.getCarFile()

  const ipld = IpldStore.createInMemory()
  const storeBob = await UserStore.fromCarFile(car, ipld)

  await util.checkUserStore(t, storeBob, programName, data)
})
