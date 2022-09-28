import * as auth from '@adxp/auth'
import { TID } from '@adxp/common'
import { Repo, RepoRoot } from '../src'
import { MemoryBlockstore } from '../src/blockstore'

import * as util from './_util'

describe('Sync', () => {
  const verifier = new auth.Verifier()

  let aliceBlockstore, bobBlockstore: MemoryBlockstore
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
    const repoBob = await Repo.fromCarFile(car, bobBlockstore)
    const data = await repoBob.data.list(10)
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
    await util.checkRepoDiff(diff, {}, repoData)
  })

  it('syncs a repo that is behind', async () => {
    // add more to alice's repo & have bob catch up
    const beforeData = JSON.parse(JSON.stringify(repoData))
    repoData = await util.editRepo(aliceRepo, repoData, {
      adds: 20,
      updates: 20,
      deletes: 20,
    })
    const diffCar = await aliceRepo.getDiffCar(bobRepo.cid)
    const diff = await bobRepo.loadAndVerifyDiff(diffCar)
    await util.checkRepo(bobRepo, repoData)
    await util.checkRepoDiff(diff, beforeData, repoData)
  })

  it('throws an error on invalid UCANs', async () => {
    const obj = util.generateObject()
    const cid = await aliceBlockstore.put(obj)
    const updatedData = await aliceRepo.data.add(
      `com.example.test/${TID.next()}`,
      cid,
    )
    // we create an unrelated token for bob & try to permission alice's repo commit with it
    const bobAuth = await verifier.createTempAuthStore()
    const badUcan = await bobAuth.claimFull()
    const auth_token = await aliceBlockstore.put(auth.encodeUcan(badUcan))
    const dataCid = await updatedData.save()
    const root: RepoRoot = {
      did: aliceRepo.did(),
      prev: aliceRepo.cid,
      auth_token,
      data: dataCid,
    }
    const rootCid = await aliceBlockstore.put(root)
    const commit = {
      root: rootCid,
      sig: await aliceAuth.sign(rootCid.bytes),
    }
    aliceRepo.cid = await aliceBlockstore.put(commit)
    aliceRepo.data = updatedData
    const diffCar = await aliceRepo.getDiffCar(bobRepo.cid)
    await expect(bobRepo.loadAndVerifyDiff(diffCar)).rejects.toThrow()
    await aliceRepo.revert(1)
  })

  it('throws on a bad signature', async () => {
    const obj = util.generateObject()
    const cid = await aliceBlockstore.put(obj)
    const updatedData = await aliceRepo.data.add(
      `com.example.test/${TID.next()}`,
      cid,
    )
    const auth_token = await aliceRepo.ucanForOperation(updatedData)
    const dataCid = await updatedData.save()
    const root: RepoRoot = {
      did: aliceRepo.did(),
      prev: aliceRepo.cid,
      auth_token,
      data: dataCid,
    }
    const rootCid = await aliceBlockstore.put(root)
    // we generated a bad sig by signing the data cid instead of root cid
    const commit = {
      root: rootCid,
      sig: await aliceAuth.sign(dataCid.bytes),
    }
    aliceRepo.cid = await aliceBlockstore.put(commit)
    aliceRepo.data = updatedData
    const diffCar = await aliceRepo.getDiffCar(bobRepo.cid)
    await expect(bobRepo.loadAndVerifyDiff(diffCar)).rejects.toThrow()
    await aliceRepo.revert(1)
  })
})
