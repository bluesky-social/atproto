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
    const repoData = await util.fillRepo(aliceRepo, {
      'bsky/posts': 200,
      'bsky/likes': 200,
    })
    const before = Date.now()
    const car = await aliceRepo.getFullHistory()
    const madeCar = Date.now()
    bobRepo = await Repo.fromCarFile(car, bobBlockstore)
    const readCar = Date.now()
    console.log('make car: ', (madeCar - before) / 1000)
    console.log('read car: ', (readCar - madeCar) / 1000)
    await util.checkRepo(bobRepo, repoData)
  })

  // it('syncs a repo that is behind', async () => {
  //   // add more to alice's repo & have bob catch up
  //   const moreData = await util.fillRepo(aliceRepo, {
  //     'bsky/posts': 20,
  //     'bsky/likes': 20,
  //   })
  //   const diff = await aliceRepo.getDiffCar(bobRepo.cid)
  //   await bobRepo.loadCarRoot(diff)
  //   await util.checkRepo(bobRepo, moreData)
  // })
})
