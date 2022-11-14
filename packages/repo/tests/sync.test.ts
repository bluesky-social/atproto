import * as auth from '@atproto/auth'
import { TID } from '@atproto/common'
import { Repo, RepoRoot, verifyUpdates, ucanForOperation } from '../src'
import { MemoryBlockstore } from '../src/blockstore'
import * as sync from '../src/sync'

import * as util from './_util'

describe('Sync', () => {
  const verifier = new auth.Verifier()

  let aliceBlockstore: MemoryBlockstore, bobBlockstore: MemoryBlockstore
  let aliceRepo: Repo
  let aliceAuth: auth.AuthStore
  let repoData: util.RepoData

  beforeAll(async () => {
    aliceBlockstore = new MemoryBlockstore()
    aliceAuth = await verifier.createTempAuthStore()
    await aliceAuth.claimFull()
    aliceRepo = await Repo.create(
      aliceBlockstore,
      await aliceAuth.did(),
      aliceAuth,
    )
    bobBlockstore = new MemoryBlockstore()
  })

  it('syncs an empty repo', async () => {
    const car = await aliceRepo.getFullHistory()
    const repoBob = await sync.loadRepoFromCar(car, bobBlockstore, verifier)
    const data = await repoBob.data.list(10)
    expect(data.length).toBe(0)
  })

  let bobRepo: Repo

  it('syncs a repo that is starting from scratch', async () => {
    const filled = await util.fillRepo(aliceRepo, aliceAuth, 100)
    aliceRepo = filled.repo
    repoData = filled.data
    await aliceRepo.getFullHistory()

    const car = await aliceRepo.getFullHistory()
    bobRepo = await sync.loadRepoFromCar(car, bobBlockstore, verifier)
    const diff = await verifyUpdates(bobBlockstore, null, bobRepo.cid, verifier)
    await util.checkRepo(bobRepo, repoData)
    await util.checkRepoDiff(diff, {}, repoData)
  })

  it('syncs a repo that is behind', async () => {
    // add more to alice's repo & have bob catch up
    const beforeData = JSON.parse(JSON.stringify(repoData))
    const edited = await util.editRepo(aliceRepo, repoData, aliceAuth, {
      adds: 20,
      updates: 20,
      deletes: 20,
    })
    aliceRepo = edited.repo
    repoData = edited.data
    const diffCar = await aliceRepo.getDiffCar(bobRepo.cid)
    const loaded = await sync.loadDiff(bobRepo, diffCar, verifier)
    await util.checkRepo(loaded.repo, repoData)
    await util.checkRepoDiff(loaded.diff, beforeData, repoData)
  })

  it('throws an error on invalid UCANs', async () => {
    const obj = util.generateObject()
    const cid = await aliceBlockstore.stage(obj)
    const updatedData = await aliceRepo.data.add(
      `com.example.test/${TID.next()}`,
      cid,
    )
    // we create an unrelated token for bob & try to permission alice's repo commit with it
    const bobAuth = await verifier.createTempAuthStore()
    const badUcan = await bobAuth.claimFull()
    const auth_token = await aliceBlockstore.stage(auth.encodeUcan(badUcan))
    const dataCid = await updatedData.stage()
    const root: RepoRoot = {
      meta: aliceRepo.root.meta,
      prev: aliceRepo.cid,
      auth_token,
      data: dataCid,
    }
    const rootCid = await aliceBlockstore.stage(root)
    const commit = {
      root: rootCid,
      sig: await aliceAuth.sign(rootCid.bytes),
    }
    const commitCid = await aliceBlockstore.stage(commit)
    const badAliceRepo = await Repo.load(aliceBlockstore, commitCid)
    const diffCar = await badAliceRepo.getDiffCar(bobRepo.cid)
    await expect(sync.loadDiff(bobRepo, diffCar, verifier)).rejects.toThrow()
    // await aliceBlockstore.clearStaged()
  })

  it('throws on a bad signature', async () => {
    const obj = util.generateObject()
    const cid = await aliceBlockstore.stage(obj)
    const updatedData = await aliceRepo.data.add(
      `com.example.test/${TID.next()}`,
      cid,
    )
    const authToken = await ucanForOperation(
      aliceRepo.data,
      updatedData,
      aliceRepo.did,
      aliceAuth,
    )
    const authCid = await aliceBlockstore.stage(authToken)
    const dataCid = await updatedData.stage()
    const root: RepoRoot = {
      meta: aliceRepo.root.meta,
      prev: aliceRepo.cid,
      auth_token: authCid,
      data: dataCid,
    }
    const rootCid = await aliceBlockstore.stage(root)
    // we generated a bad sig by signing the data cid instead of root cid
    const commit = {
      root: rootCid,
      sig: await aliceAuth.sign(dataCid.bytes),
    }
    const commitCid = await aliceBlockstore.stage(commit)
    const badAliceRepo = await Repo.load(aliceBlockstore, commitCid)
    const diffCar = await badAliceRepo.getDiffCar(bobRepo.cid)
    await expect(sync.loadDiff(bobRepo, diffCar, verifier)).rejects.toThrow()
  })
})
