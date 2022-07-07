import test from 'ava'

import * as auth from '@adxp/auth'
import Repo from '../src/repo/index'
import IpldStore from '../src/blockstore/ipld-store'
import * as delta from '../src/repo/delta'

import * as util from './_util'
import TID from '../src/repo/tid'

type Context = {
  ipldAlice: IpldStore
  alice: Repo
  ipldBob: IpldStore
  tokenBob: auth.Ucan
  namespaceId: string
}

test.beforeEach(async (t) => {
  const ipldAlice = IpldStore.createInMemory()
  const authStore = await auth.MemoryStore.load()
  await authStore.claimFull()
  const alice = await Repo.create(ipldAlice, await authStore.did(), authStore)

  const ipldBob = IpldStore.createInMemory()

  const namespaceId = 'did:example:test'
  t.context = {
    ipldAlice,
    alice,
    ipldBob,
    namespaceId,
  } as Context
  t.pass('Context setup')
})

test('syncs a repo that is behind', async (t) => {
  const { alice, ipldBob, namespaceId } = t.context as Context

  // bring bob up to date with early version of alice's repo
  await util.fillRepo(alice, namespaceId, 150, 10, 50)
  const car = await alice.getFullHistory()
  const bob = await Repo.fromCarFile(car, ipldBob)

  await alice.runOnNamespace(namespaceId, async (namespace) => {
    const postTid = TID.next()
    const cid = await util.randomCid(alice.blockstore)
    await namespace.posts.addEntry(postTid, cid)
    await namespace.posts.editEntry(
      postTid,
      await util.randomCid(alice.blockstore),
    )
    await namespace.posts.deleteEntry(postTid)
    const interTid = TID.next()
    await namespace.interactions.addEntry(
      interTid,
      await util.randomCid(alice.blockstore),
    )
    await namespace.interactions.editEntry(
      interTid,
      await util.randomCid(alice.blockstore),
    )
    await namespace.interactions.deleteEntry(interTid)
  })

  const follow = util.randomFollow()
  await alice.relationships.follow(follow.did, follow.username)
  await alice.relationships.unfollow(follow.did)

  const diff = await alice.getDiffCar(bob.cid)
  const events: delta.Event[] = []
  await bob.loadAndVerifyDiff(diff, async (evt) => {
    events.push(evt)
  })

  t.is(events.length, 8, 'correct number of events')
  t.is(events[0].event, delta.EventType.AddedObject, 'added object event')
  t.is(events[1].event, delta.EventType.UpdatedObject, 'updated object event')
  t.is(events[2].event, delta.EventType.DeletedObject, 'deleted object event')
  t.is(events[3].event, delta.EventType.AddedObject, 'added object event')
  t.is(events[4].event, delta.EventType.UpdatedObject, 'updated object event')
  t.is(events[5].event, delta.EventType.DeletedObject, 'deleted object event')
  t.is(events[6].event, delta.EventType.AddedRelationship, 'added rel event')
  t.is(
    events[7].event,
    delta.EventType.DeletedRelationship,
    'updated rel event',
  )
})
