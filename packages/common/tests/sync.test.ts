import * as auth from '@adxp/auth'
import { MST, Repo } from '../src/repo'
import IpldStore from '../src/blockstore/ipld-store'

import * as util from './_util'

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

const morePosts = [
  { name: 'post9' },
  { name: 'post10' },
  { name: 'post11' },
  { name: 'post12' },
  { name: 'post13' },
  { name: 'post14' },
  { name: 'post15' },
  { name: 'post16' },
  { name: 'post17' },
]

const moreLikes = [
  { name: 'like9' },
  { name: 'like10' },
  { name: 'like11' },
  { name: 'like12' },
  { name: 'like13' },
  { name: 'like14' },
  { name: 'like15' },
  { name: 'like16' },
  { name: 'like17' },
]

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
    for (const post of posts) {
      await postsColl.createRecord(post)
    }
    const likesColl = aliceRepo.getCollection('bsky/likes')
    for (const like of likes) {
      await likesColl.createRecord(like)
    }
    // data = await util.fillRepo(aliceRepo, namespaceId, 150, 10, 50)
    const car = await aliceRepo.getFullHistory()
    bobRepo = await Repo.fromCarFile(car, bobBlockstore)
    const bobPosts = await bobRepo.getCollection('bsky/posts').listRecords()
    const bobLikes = await bobRepo.getCollection('bsky/likes').listRecords()
    expect(bobPosts).toEqual(posts)
    expect(bobLikes).toEqual(likes)
    // await util.checkRepo(repoBob, namespaceId, data)
  })

  // it('syncs a repo that is behind', async () => {
  //   // add more to alice's repo & have bob catch up
  //   const data2 = await util.fillRepo(aliceRepo, namespaceId, 300, 10, 50)
  //   const diff = await aliceRepo.getDiffCar(repoBob.cid)
  //   await repoBob.loadCarRoot(diff)

  //   const allData = {
  //     posts: {
  //       ...data.posts,
  //       ...data2.posts,
  //     },
  //     interactions: {
  //       ...data.interactions,
  //       ...data2.interactions,
  //     },
  //     follows: {
  //       ...data.follows,
  //       ...data2.follows,
  //     },
  //   }

  //   await util.checkRepo(repoBob, namespaceId, allData)
  // })
})
