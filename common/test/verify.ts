import test from 'ava'

import * as ucan from 'ucans'

import * as auth from '../src/auth/index.js'
import Repo from '../src/repo/index.js'
import IpldStore from '../src/blockstore/ipld-store.js'

import * as util from './_util.js'

type Context = {
  ipldAlice: IpldStore
  alice: Repo
  ipldBob: IpldStore
  tokenBob: ucan.Chained
  namespaceId: string
}

test.beforeEach(async (t) => {
  const ipldAlice = IpldStore.createInMemory()
  const keypairAlice = await ucan.EdKeypair.create()
  const token = await auth.claimFull(keypairAlice.did(), keypairAlice)
  const ucanStore = await ucan.Store.fromTokens([token.encoded()])
  const alice = await Repo.create(
    ipldAlice,
    keypairAlice.did(),
    keypairAlice,
    ucanStore,
  )

  const ipldBob = IpldStore.createInMemory()

  const namespaceId = 'did:bsky:test'
  t.context = {
    ipldAlice,
    alice,
    ipldBob,
    namespaceId,
  } as Context
  t.pass('Context setup')
})

// test('syncs an empty repo', async (t) => {
//   const { alice, ipldBob } = t.context as Context
//   const car = await alice.getFullHistory()
//   const bob = await Repo.fromCarFile(car, ipldBob)
//   t.deepEqual(bob.namespaceCids, {}, 'loads an empty repo')
// })

// test('syncs a repo that is starting from scratch', async (t) => {
//   const { alice, ipldBob, namespaceId } = t.context as Context
//   const data = await util.fillRepo(alice, namespaceId, 150, 10, 50)
//   const car = await alice.getFullHistory()
//   const bob = await Repo.fromCarFile(car, ipldBob)
//   await util.checkRepo(t, bob, namespaceId, data)
// })

test('syncs a repo that is behind', async (t) => {
  const { alice, ipldBob, namespaceId } = t.context as Context

  // bring bob up to date with early version of alice's repo
  const data = await util.fillRepo(alice, namespaceId, 150, 10, 50)
  const car = await alice.getFullHistory()
  const bob = await Repo.fromCarFile(car, ipldBob)

  const data2 = await util.fillRepo(alice, namespaceId, 3, 2, 3)
  const diff = await alice.getDiffCar(bob.cid)
  const events = await bob.loadAndVerifyDiff(diff, async (evt) => {
    console.log('EVENT: ', evt)
  })
  t.pass('yay')

  // add more to alice's repo & have bob catch up
  // const data2 = await util.fillRepo(alice, namespaceId, 300, 10, 50)
  // const diff = await alice.getDiffCar(bob.cid)
  // await bob.loadCar(diff)

  // const allData = {
  //   posts: {
  //     ...data.posts,
  //     ...data2.posts,
  //   },
  //   interactions: {
  //     ...data.interactions,
  //     ...data2.interactions,
  //   },
  //   follows: {
  //     ...data.follows,
  //     ...data2.follows,
  //   },
  // }

  // await util.checkRepo(t, bob, namespaceId, allData)
})

// test('syncs a non-historical copy of a repo', async (t) => {
//   const { alice, namespaceId } = t.context as Context
//   const data = await util.fillRepo(alice, namespaceId, 150, 20, 50)
//   const car = await alice.getCarNoHistory()

//   const ipld = IpldStore.createInMemory()
//   const bob = await Repo.fromCarFile(car, ipld)

//   await util.checkRepo(t, bob, namespaceId, data)
// })
