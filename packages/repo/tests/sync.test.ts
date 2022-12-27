import * as crypto from '@atproto/crypto'
import { TID } from '@atproto/common'
import { DidResolver } from '@atproto/did-resolver'
import { Repo, RepoRoot, verifyUpdates } from '../src'
import BlockMap from '../src/block-map'
import { MemoryBlockstore } from '../src/storage'
import * as sync from '../src/sync'

import * as util from './_util'

describe('Sync', () => {
  let aliceBlockstore: MemoryBlockstore, bobBlockstore: MemoryBlockstore
  let aliceRepo: Repo
  let aliceKey: crypto.Keypair
  let repoData: util.RepoData
  const didResolver = new DidResolver()

  beforeAll(async () => {
    aliceBlockstore = new MemoryBlockstore()
    aliceKey = await crypto.Secp256k1Keypair.create()
    aliceRepo = await Repo.create(aliceBlockstore, aliceKey.did(), aliceKey)
    bobBlockstore = new MemoryBlockstore()
  })

  it('syncs an empty repo', async () => {
    const car = await aliceRepo.getFullHistory()
    const repoBob = await sync.loadRepoFromCar(car, bobBlockstore, didResolver)
    const data = await repoBob.data.list(10)
    expect(data.length).toBe(0)
  })

  let bobRepo: Repo

  it('syncs a repo that is starting from scratch', async () => {
    const filled = await util.fillRepo(aliceRepo, aliceKey, 100)
    aliceRepo = filled.repo
    repoData = filled.data
    await aliceRepo.getFullHistory()

    const car = await aliceRepo.getFullHistory()
    bobRepo = await sync.loadRepoFromCar(car, bobBlockstore, didResolver)
    const diff = await verifyUpdates(
      bobBlockstore,
      bobRepo.cid,
      null,
      didResolver,
    )
    await util.checkRepo(bobRepo, repoData)
    await util.checkRepoDiff(diff, {}, repoData)
  })

  it('syncs a repo that is behind', async () => {
    // add more to alice's repo & have bob catch up
    const beforeData = JSON.parse(JSON.stringify(repoData))
    const edited = await util.editRepo(aliceRepo, repoData, aliceKey, {
      adds: 20,
      updates: 20,
      deletes: 20,
    })
    aliceRepo = edited.repo
    repoData = edited.data
    const diffCar = await aliceRepo.getDiffCar(bobRepo.cid)
    const loaded = await sync.loadDiff(bobRepo, diffCar, didResolver)
    await util.checkRepo(loaded.repo, repoData)
    await util.checkRepoDiff(loaded.diff, beforeData, repoData)
  })

  it('throws on a bad signature', async () => {
    const obj = util.generateObject()
    const blocks = new BlockMap()
    const cid = await blocks.add(obj)
    const updatedData = await aliceRepo.data.add(
      `com.example.test/${TID.next()}`,
      cid,
    )
    const dataDiff = await updatedData.blockDiff()
    blocks.addMap(dataDiff.blocks)
    const root: RepoRoot = {
      meta: aliceRepo.root.meta,
      prev: aliceRepo.cid,
      data: dataDiff.root,
    }
    const rootCid = await blocks.add(root)
    // we generated a bad sig by signing the data cid instead of root cid
    const commit = {
      root: rootCid,
      sig: await aliceKey.sign(dataDiff.root.bytes),
    }
    const commitCid = await blocks.add(commit)
    await aliceBlockstore.putMany(blocks)
    const badAliceRepo = await Repo.load(aliceBlockstore, commitCid)
    const diffCar = await badAliceRepo.getDiffCar(bobRepo.cid)
    await expect(sync.loadDiff(bobRepo, diffCar, didResolver)).rejects.toThrow()
  })
})
