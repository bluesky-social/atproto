import test from 'ava'

import * as ucan from 'ucans'

import Repo from '../src/repo/index.js'
import IpldStore from '../src/blockstore/ipld-store.js'

import * as util from './_util.js'

type Context = {
  ipldAlice: IpldStore
  keypairAlice: ucan.EdKeypair
  repoAlice: Repo
  ipldBob: IpldStore
  keypairBob: ucan.EdKeypair
  programName: string
}

test.beforeEach(async (t) => {
  const ipldAlice = IpldStore.createInMemory()
  const keypairAlice = await ucan.EdKeypair.create()
  const repoAlice = await Repo.create(ipldAlice, keypairAlice)

  const ipldBob = IpldStore.createInMemory()
  const keypairBob = await ucan.EdKeypair.create()

  const programName = 'did:bsky:test'
  t.context = {
    ipldAlice,
    keypairAlice,
    repoAlice,
    ipldBob,
    keypairBob,
    programName,
  } as Context
  t.pass('Context setup')
})

test('syncs an empty repo', async (t) => {
  const { repoAlice, ipldBob, keypairBob } = t.context as Context
  const car = await repoAlice.getFullHistory()
  const repoBob = await Repo.fromCarFile(car, ipldBob, keypairBob)
  t.deepEqual(repoBob.programCids, {}, 'loads an empty repo')
})

test('syncs a repo that is starting from scratch', async (t) => {
  const { repoAlice, ipldBob, keypairBob, programName } = t.context as Context
  const data = await util.fillRepo(repoAlice, programName, 150, 10)
  const car = await repoAlice.getFullHistory()
  const repoBob = await Repo.fromCarFile(car, ipldBob, keypairBob)
  await util.checkRepo(t, repoBob, programName, data)
})

test('syncs a repo that is behind', async (t) => {
  const { repoAlice, ipldBob, keypairBob, programName } = t.context as Context

  const data = await util.fillRepo(repoAlice, programName, 150, 10)
  const car = await repoAlice.getFullHistory()
  const repoBob = await Repo.fromCarFile(car, ipldBob, keypairBob)

  const data2 = await util.fillRepo(repoAlice, programName, 300, 10)
  const diff = await repoAlice.getDiffCar(repoBob.cid)
  await repoBob.loadCar(diff)

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

  await util.checkRepo(t, repoBob, programName, allData)
})

test('syncs a non-historical copy of a repo', async (t) => {
  const { repoAlice, programName } = t.context as Context
  const data = await util.fillRepo(repoAlice, programName, 150, 20)
  const car = await repoAlice.getCarNoHistory()

  const ipld = IpldStore.createInMemory()
  const repoBob = await Repo.fromCarFile(car, ipld)

  await util.checkRepo(t, repoBob, programName, data)
})
