import * as auth from '@adxp/auth'
import { Repo } from '../src/repo'
import IpldStore from '../src/blockstore/ipld-store'

import * as fixtures from './fixtures'
import * as util from './_util'

describe('Sync', () => {
  let aliceBlockstore, bobBlockstore: IpldStore
  let aliceRepo: Repo
  const namespaceId = 'did:example:test'

  beforeAll(async () => {
    aliceBlockstore = IpldStore.createInMemory()
    const authStore = await auth.MemoryStore.load()
    await authStore.claimFull()
    aliceRepo = await Repo.create(
      aliceBlockstore,
      await authStore.did(),
      authStore,
    )
    bobBlockstore = IpldStore.createInMemory()
  })

  it('syncs an empty repo', async () => {
    const car = await aliceRepo.getFullHistory()
    const repoBob = await Repo.fromCarFile(car, bobBlockstore)
    const data = await repoBob.data.list('', 10)
    expect(data.length).toBe(0)
  })

  let data: util.RepoData
  let bobRepo: Repo

  it('syncs a repo that is starting from scratch', async () => {
    const postsColl = aliceRepo.getCollection('bsky/posts')
    for (const post of fixtures.posts) {
      await postsColl.createRecord(post)
    }
    const likesColl = aliceRepo.getCollection('bsky/likes')
    for (const like of fixtures.likes) {
      await likesColl.createRecord(like)
    }
    // data = await util.fillRepo(aliceRepo, namespaceId, 150, 10, 50)
    const car = await aliceRepo.getFullHistory()
    bobRepo = await Repo.fromCarFile(car, bobBlockstore)
    const bobPosts = await bobRepo.getCollection('bsky/posts').listRecords()
    expect(bobPosts).toEqual(posts)
    const bobLikes = await bobRepo.getCollection('bsky/likes').listRecords()
    expect(bobLikes).toEqual(likes)
    // await util.checkRepo(repoBob, namespaceId, data)
  })

  it('syncs a repo that is behind', async () => {
    // add more to alice's repo & have bob catch up
    const postsColl = aliceRepo.getCollection('bsky/posts')
    for (const post of morePosts) {
      await postsColl.createRecord(post)
    }
    const likesColl = aliceRepo.getCollection('bsky/likes')
    for (const like of moreLikes) {
      await likesColl.createRecord(like)
    }
    // const data2 = await util.fillRepo(aliceRepo, namespaceId, 300, 10, 50)
    const diff = await aliceRepo.getDiffCar(bobRepo.cid)
    await bobRepo.loadCarRoot(diff)

    const bobPosts = await bobRepo.getCollection('bsky/posts').listRecords()
    expect(bobPosts).toEqual([...posts, ...morePosts])
    const bobLikes = await bobRepo.getCollection('bsky/likes').listRecords()
    expect(bobLikes).toEqual([...likes, ...moreLikes])
    // await util.checkRepo(repoBob, namespaceId, allData)
  })
})
