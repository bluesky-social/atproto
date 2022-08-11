import * as auth from '@adxp/auth'
import { Repo } from '../src/repo'
import { MemoryBlockstore } from '../src/blockstore'

import * as util from './_util'

describe('Sync', () => {
  let aliceBlockstore, bobBlockstore: MemoryBlockstore
  let aliceRepo: Repo
  let repoData: util.RepoData

  beforeAll(async () => {
    aliceBlockstore = new MemoryBlockstore()
    const authStore = await auth.MemoryStore.load()
    await authStore.claimFull()
    aliceRepo = await Repo.create(
      aliceBlockstore,
      await authStore.did(),
      authStore,
    )
    bobBlockstore = new MemoryBlockstore()
  })

  it('syncs an empty repo', async () => {
    const car = await aliceRepo.getFullHistory()
    const repoBob = await Repo.fromCarFile(car, bobBlockstore)
    const data = await repoBob.data.list('', 10)
    expect(data.length).toBe(0)
  })

  let bobRepo: Repo

  it('syncs a repo that is starting from scratch', async () => {
    repoData = await util.fillRepo(aliceRepo, 100)
    try {
      const car = await aliceRepo.getFullHistory()
    } catch (err) {
      const contents = await aliceBlockstore.getContents()
      console.log(contents)
      throw err
    }

    const car = await aliceRepo.getFullHistory()
    bobRepo = await Repo.fromCarFile(car, bobBlockstore)
    const diff = await bobRepo.verifySetOfUpdates(null, bobRepo.cid)
    await util.checkRepo(bobRepo, repoData)
  })

  it('syncs a repo that is behind', async () => {
    // add more to alice's repo & have bob catch up
    repoData = await util.editRepo(aliceRepo, repoData, {
      adds: 20,
      updates: 20,
      deletes: 20,
    })
    const diffCar = await aliceRepo.getDiffCar(bobRepo.cid)
    const diff = await bobRepo.loadAndVerifyDiff(diffCar)
    await util.checkRepo(bobRepo, repoData)
  })
})
