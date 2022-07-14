import * as auth from '@adxp/auth'

import Repo from '../src/repo/index'
import IpldStore from '../src/blockstore/ipld-store'

import * as util from './_util'
import TID from '../src/repo/tid'

describe('Repo', () => {
  let ipldStore: IpldStore
  let authStore: auth.AuthStore
  let repo: Repo
  const namespaceId = 'did:example:test'
  const otherNamespace = 'did:example:other'

  it('creates repo', async () => {
    ipldStore = IpldStore.createInMemory()
    authStore = await auth.MemoryStore.load()
    await authStore.claimFull()
    repo = await Repo.create(ipldStore, await authStore.did(), authStore)
  })

  it('adds a valid signature to commit', async () => {
    const commit = await repo.getCommit()
    const verified = await auth.didPlugins.verifySignature(
      repo.did,
      commit.root.bytes,
      commit.sig,
    )
    expect(verified).toBeTruthy()
  })

  it('sets correct DID', async () => {
    expect(repo.did).toEqual(await authStore.did())
  })

  it('runs operations on the related namespace', async () => {
    const tid = TID.next()
    const cid = await util.randomCid()
    await repo.runOnNamespace(namespaceId, async (namespace) => {
      await namespace.posts.addEntry(tid, cid)
    })

    const got = await repo.runOnNamespace(namespaceId, async (namespace) => {
      return namespace.posts.getEntry(tid)
    })
    expect(got).toEqual(cid)
  })

  it('name spaces namespaces', async () => {
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
    expect(got[0]).toEqual(cid)
    expect(got[1]).toEqual(null)

    const gotOther = await repo.runOnNamespace(
      otherNamespace,
      async (namespace) => {
        return Promise.all([
          namespace.posts.getEntry(tid),
          namespace.posts.getEntry(tidOther),
        ])
      },
    )
    expect(gotOther[0]).toEqual(null)
    expect(gotOther[1]).toEqual(cidOther)
  })

  it('basic relationship operations', async () => {
    const follow = util.randomFollow()

    await repo.relationships.follow(follow.did, follow.username)

    let got = await repo.relationships.getFollow(follow.did)
    expect(got).toEqual(follow)

    const isFollowing = await repo.relationships.isFollowing(follow.did)
    expect(isFollowing).toBeTruthy()

    await repo.relationships.unfollow(follow.did)
    got = await repo.relationships.getFollow(follow.did)
    expect(got).toBe(null)
  })

  it('loads from blockstore', async () => {
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

    const loaded = await Repo.load(ipldStore, repo.cid)
    const got = await loaded.runOnNamespace(namespaceId, async (namespace) => {
      return Promise.all([
        namespace.posts.getEntry(postTid),
        namespace.interactions.getEntry(interTid),
      ])
    })
    const gotFollow = await loaded.relationships.getFollow(follow.did)
    expect(got[0]).toEqual(postCid)
    expect(got[1]).toEqual(interCid)
    expect(gotFollow).toEqual(follow)
  })
})
