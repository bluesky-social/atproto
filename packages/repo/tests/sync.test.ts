import * as crypto from '@atproto/crypto'
import { TID } from '@atproto/common'
import { DidResolver } from '@atproto/did-resolver'
import { Repo, RepoContents, RepoRoot } from '../src'
import BlockMap from '../src/block-map'
import { MemoryBlockstore } from '../src/storage'
import * as sync from '../src/sync'

import * as util from './_util'

describe('Sync', () => {
  let storage: MemoryBlockstore
  let syncStorage: MemoryBlockstore
  let checkoutStorage: MemoryBlockstore
  let repo: Repo
  let keypair: crypto.Keypair
  let repoData: RepoContents
  const didResolver = new DidResolver()

  beforeAll(async () => {
    storage = new MemoryBlockstore()
    keypair = await crypto.Secp256k1Keypair.create()
    repo = await Repo.create(storage, keypair.did(), keypair)
    syncStorage = new MemoryBlockstore()
    checkoutStorage = new MemoryBlockstore()
  })

  let bobRepo: Repo

  it('syncs an empty repo', async () => {
    const car = await sync.getFullRepo(storage, repo.cid)
    const loaded = await sync.loadFullRepo(syncStorage, car, didResolver)
    bobRepo = await Repo.load(syncStorage, loaded.root)
    const data = await bobRepo.data.list(10)
    expect(data.length).toBe(0)
  })

  it('syncs a repo that is starting from scratch', async () => {
    const filled = await util.fillRepo(repo, keypair, 100)
    repo = filled.repo
    repoData = filled.data

    const car = await sync.getFullRepo(storage, repo.cid)
    const loaded = await sync.loadFullRepo(syncStorage, car, didResolver)
    bobRepo = await Repo.load(syncStorage, loaded.root)
    const contents = await bobRepo.getContents()
    expect(contents).toEqual(repoData)
    await util.verifyRepoDiff(loaded.writeLog, {}, repoData)
  })

  it('syncs a repo that is behind', async () => {
    // add more to alice's repo & have bob catch up
    const beforeData = JSON.parse(JSON.stringify(repoData))
    const edited = await util.editRepo(repo, repoData, keypair, {
      adds: 20,
      updates: 20,
      deletes: 20,
    })
    repo = edited.repo
    repoData = edited.data
    const diffCar = await sync.getDiff(storage, repo.cid, bobRepo.cid)
    const loaded = await sync.loadDiff(bobRepo, diffCar, didResolver)
    bobRepo = await Repo.load(syncStorage, loaded.root)
    const contents = await bobRepo.getContents()
    expect(contents).toEqual(repoData)
    await util.verifyRepoDiff(loaded.writeLog, beforeData, repoData)
  })

  it('throws on a bad signature', async () => {
    const obj = util.generateObject()
    const blocks = new BlockMap()
    const cid = await blocks.add(obj)
    const updatedData = await repo.data.add(
      `com.example.test/${TID.next()}`,
      cid,
    )
    const unstoredData = await updatedData.getUnstoredBlocks()
    blocks.addMap(unstoredData.blocks)
    const root: RepoRoot = {
      meta: repo.root.meta,
      prev: repo.cid,
      data: unstoredData.root,
    }
    const rootCid = await blocks.add(root)
    // we generate a bad sig by signing the data cid instead of root cid
    const commit = {
      root: rootCid,
      sig: await keypair.sign(unstoredData.root.bytes),
    }
    const commitCid = await blocks.add(commit)
    await storage.putMany(blocks)
    const badRepo = await Repo.load(storage, commitCid)
    const diffCar = await sync.getDiff(storage, badRepo.cid, bobRepo.cid)
    await expect(sync.loadDiff(bobRepo, diffCar, didResolver)).rejects.toThrow()
  })

  it('sync a non-historical repo checkout', async () => {
    const checkoutCar = await sync.getCheckout(storage, repo.cid)
    const checkout = await sync.loadCheckout(
      checkoutStorage,
      checkoutCar,
      didResolver,
    )
    const checkoutRepo = await Repo.load(checkoutStorage, checkout.root)
    const contents = await checkoutRepo.getContents()
    expect(contents).toEqual(repoData)
    expect(checkout.contents).toEqual(repoData)
  })

  it('does not sync unneeded blocks during checkout', async () => {
    const commitPath = await storage.getCommitPath(repo.cid, null)
    if (!commitPath) {
      throw new Error('Could not get commitPath')
    }
    const hasGenesisCommit = await checkoutStorage.has(commitPath[0])
    expect(hasGenesisCommit).toBeFalsy()
  })
})
