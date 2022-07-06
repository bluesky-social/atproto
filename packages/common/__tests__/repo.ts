import test from 'ava'

import * as auth from '@adxp/auth'

import Repo from '../src/repo/index'
import IpldStore from '../src/blockstore/ipld-store'

import * as util from './_util'
import TID from '../src/repo/tid'

type Context = {
  ipld: IpldStore
  authStore: auth.AuthStore
  repo: Repo
  namespaceId: string
  otherNamespace: string
}

test.beforeEach(async (t) => {
  const ipld = IpldStore.createInMemory()
  const authStore = await auth.MemoryStore.load()
  await authStore.claimFull()
  const repo = await Repo.create(ipld, await authStore.did(), authStore)
  const namespaceId = 'did:example:test'
  const otherNamespace = 'did:example:other'
  t.context = { ipld, repo, authStore, namespaceId, otherNamespace } as Context
  t.pass('Context setup')
})

test('adds a valid signature to commit', async (t) => {
  const { repo } = t.context as Context

  const commit = await repo.getCommit()
  const verified = await auth.didPlugins.verifySignature(
    repo.did,
    commit.root.bytes,
    commit.sig,
  )
  t.true(verified, 'signature matches DID of root')
})

test('sets correct DID', async (t) => {
  const { repo, authStore } = t.context as Context
  t.is(repo.did, await authStore.did(), 'DIDs match')
})

test('runs operations on the related namespace', async (t) => {
  const { repo, namespaceId } = t.context as Context

  const tid = TID.next()
  const cid = await util.randomCid()
  await repo.runOnNamespace(namespaceId, async (namespace) => {
    await namespace.posts.addEntry(tid, cid)
  })

  const got = await repo.runOnNamespace(namespaceId, async (namespace) => {
    return namespace.posts.getEntry(tid)
  })
  t.deepEqual(got, cid, `Matching content for post tid: ${tid}`)
})

test('name spaces namespaces', async (t) => {
  const { repo, namespaceId, otherNamespace } = t.context as Context

  const tid = TID.next()
  const cid = await util.randomCid()
  await repo.runOnNamespace(namespaceId, async (namespace) => {
    await namespace.posts.addEntry(tid, cid)
  })

  const tidOther = TID.next()
  const cidOther = await util.randomCid()
  await repo.runOnNamespace(otherNamespace, async (namespace) => {
    await namespace.posts.addEntry(tidOther, cidOther)
  })

  const got = await repo.runOnNamespace(namespaceId, async (namespace) => {
    return Promise.all([
      namespace.posts.getEntry(tid),
      namespace.posts.getEntry(tidOther),
    ])
  })
  t.deepEqual(got[0], cid, 'correctly retrieves tid from namespace')
  t.deepEqual(got[1], null, 'cannot find tid from other namespace')

  const gotOther = await repo.runOnNamespace(
    otherNamespace,
    async (namespace) => {
      return Promise.all([
        namespace.posts.getEntry(tid),
        namespace.posts.getEntry(tidOther),
      ])
    },
  )
  t.deepEqual(gotOther[0], null, 'cannot find tid from other namespace')
  t.deepEqual(gotOther[1], cidOther, 'correctly retrieves tid from namespace')
})

test('basic relationship operations', async (t) => {
  const { repo } = t.context as Context
  const follow = util.randomFollow()

  await repo.relationships.follow(follow.did, follow.username)

  let got = await repo.relationships.getFollow(follow.did)
  t.deepEqual(got, follow, 'correctly adds & retrieves follow')

  const isFollowing = await repo.relationships.isFollowing(follow.did)
  t.true(isFollowing, 'correctly reports isFollowing DID')

  await repo.relationships.unfollow(follow.did)
  got = await repo.relationships.getFollow(follow.did)
  t.is(got, null, 'deletes follows')
})

test('loads from blockstore', async (t) => {
  const { ipld, repo, namespaceId } = t.context as Context
  const postTid = TID.next()
  const postCid = await util.randomCid()
  const interTid = TID.next()
  const interCid = await util.randomCid()
  const follow = util.randomFollow()

  await repo.runOnNamespace(namespaceId, async (namespace) => {
    await namespace.posts.addEntry(postTid, postCid)
    await namespace.interactions.addEntry(interTid, interCid)
  })

  await repo.relationships.follow(follow.did, follow.username)

  const loaded = await Repo.load(ipld, repo.cid)
  const got = await loaded.runOnNamespace(namespaceId, async (namespace) => {
    return Promise.all([
      namespace.posts.getEntry(postTid),
      namespace.interactions.getEntry(interTid),
    ])
  })
  const gotFollow = await loaded.relationships.getFollow(follow.did)
  t.deepEqual(got[0], postCid, 'loads posts from blockstore')
  t.deepEqual(got[1], interCid, 'loads interaction from blockstore')
  t.deepEqual(gotFollow, follow, 'loads follow from blockstore')
})
