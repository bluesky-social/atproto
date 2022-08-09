import * as auth from '@adxp/auth'

import { Repo } from '../src/repo'
import IpldStore from '../src/blockstore/ipld-store'

import * as util from './_util'
import TID from '../src/repo/tid'

const posts = [
  { name: 'post1' },
  { name: 'post2' },
  { name: 'post3' },
  { name: 'post4' },
  { name: 'post5' },
  { name: 'post6' },
  { name: 'post7' },
  { name: 'post8' },
]

const likes = [
  { name: 'like1' },
  { name: 'like2' },
  { name: 'like3' },
  { name: 'like4' },
  { name: 'like5' },
  { name: 'like6' },
  { name: 'like7' },
  { name: 'like8' },
]

describe('Repo', () => {
  let blockstore: IpldStore
  let authStore: auth.AuthStore
  let repo: Repo
  const postsCollName = 'bsky/posts'
  const likesCollName = 'bsky/likes'

  it('creates repo', async () => {
    blockstore = IpldStore.createInMemory()
    authStore = await auth.MemoryStore.load()
    await authStore.claimFull()
    repo = await Repo.create(blockstore, await authStore.did(), authStore)
  })

  it('adds content within a given collection', async () => {
    const postsColl = repo.getCollection(postsCollName)
    for (const post of posts) {
      await postsColl.createRecord(post)
    }
    const listedPosts = await postsColl.listRecords()
    expect(listedPosts).toEqual(posts)
  })

  it('adds content within another collection', async () => {
    const likesColl = repo.getCollection(likesCollName)
    for (const like of likes) {
      await likesColl.createRecord(like)
    }
    const listedLikes = await likesColl.listRecords()
    expect(listedLikes).toEqual(likes)
  })

  it('adds a valid signature to commit', async () => {
    const commit = await repo.getCommit()
    const verified = await auth.verifySignature(
      repo.did,
      commit.root.bytes,
      commit.sig,
    )
    expect(verified).toBeTruthy()
  })

  it('sets correct DID', async () => {
    expect(repo.did).toEqual(await authStore.did())
  })

  it('loads from blockstore', async () => {
    const reloadedRepo = await Repo.load(blockstore, repo.cid, authStore)

    const listedPosts = await reloadedRepo
      .getCollection(postsCollName)
      .listRecords()
    expect(listedPosts).toEqual(posts)

    const listedLikes = await reloadedRepo
      .getCollection(likesCollName)
      .listRecords()
    expect(listedLikes).toEqual(likes)
  })
})
