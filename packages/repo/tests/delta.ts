import * as auth from '@adxp/auth'
import Repo from '../src/repo/index'
import IpldStore from '../src/blockstore/ipld-store'
import * as delta from '../src/repo/delta'

import * as util from './_util'
import TID from '../src/repo/tid'

describe('Delta', () => {
  let alice: Repo
  let ipldBob: IpldStore
  const namespaceId = 'did:example:test'

  beforeAll(async () => {
    const ipldAlice = IpldStore.createInMemory()
    const authStore = await auth.MemoryStore.load()
    await authStore.claimFull()
    alice = await Repo.create(ipldAlice, await authStore.did(), authStore)
    ipldBob = IpldStore.createInMemory()
  })

  it('syncs a repo that is behind', async () => {
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

    expect(events.length).toEqual(8)
    expect(events[0].event).toEqual(delta.EventType.AddedObject)
    expect(events[1].event).toEqual(delta.EventType.UpdatedObject)
    expect(events[2].event).toEqual(delta.EventType.DeletedObject)
    expect(events[3].event).toEqual(delta.EventType.AddedObject)
    expect(events[4].event).toEqual(delta.EventType.UpdatedObject)
    expect(events[5].event).toEqual(delta.EventType.DeletedObject)
    expect(events[6].event).toEqual(delta.EventType.AddedRelationship)
    expect(events[7].event).toEqual(delta.EventType.DeletedRelationship)
  })
})
