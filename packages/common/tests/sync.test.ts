import * as auth from '@adxp/auth'
import Repo from '../src/repo/index'
import IpldStore from '../src/blockstore/ipld-store'

import * as util from './_util'

describe('Sync', () => {
  let ipldAlice, ipldBob: IpldStore
  let repoAlice: Repo
  const namespaceId = 'did:example:test'

  beforeAll(async () => {
    ipldAlice = IpldStore.createInMemory()
    const authStore = await auth.MemoryStore.load()
    await authStore.claimFull()
    repoAlice = await Repo.create(ipldAlice, await authStore.did(), authStore)
    ipldBob = IpldStore.createInMemory()
  })

  it('syncs an empty repo', async () => {
    const car = await repoAlice.getFullHistory()
    const repoBob = await Repo.fromCarFile(car, ipldBob)
    expect(repoBob.namespaceCids).toEqual({})
  })

  let data: util.RepoData
  let repoBob: Repo

  it('syncs a repo that is starting from scratch', async () => {
    data = await util.fillRepo(repoAlice, namespaceId, 150, 10, 50)
    const car = await repoAlice.getFullHistory()
    repoBob = await Repo.fromCarFile(car, ipldBob)
    await util.checkRepo(repoBob, namespaceId, data)
  })

  it('syncs a repo that is behind', async () => {
    // add more to alice's repo & have bob catch up
    const data2 = await util.fillRepo(repoAlice, namespaceId, 300, 10, 50)
    const diff = await repoAlice.getDiffCar(repoBob.cid)
    await repoBob.loadCarRoot(diff)

    const allData = {
      posts: {
        ...data.posts,
        ...data2.posts,
      },
      interactions: {
        ...data.interactions,
        ...data2.interactions,
      },
      follows: {
        ...data.follows,
        ...data2.follows,
      },
    }

    await util.checkRepo(repoBob, namespaceId, allData)
  })
})
