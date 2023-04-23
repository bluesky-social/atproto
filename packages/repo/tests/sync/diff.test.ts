import * as crypto from '@atproto/crypto'
import { Repo, RepoContents } from '../../src'
import { MemoryBlockstore } from '../../src/storage'
import * as sync from '../../src/sync'

import * as util from '../_util'
import { streamToBuffer } from '@atproto/common'

describe('Diff Sync', () => {
  let storage: MemoryBlockstore
  let syncStorage: MemoryBlockstore
  let repo: Repo
  let keypair: crypto.Keypair
  let repoData: RepoContents

  const repoDid = 'did:example:test'

  beforeAll(async () => {
    storage = new MemoryBlockstore()
    keypair = await crypto.Secp256k1Keypair.create()
    repo = await Repo.create(storage, repoDid, keypair)
    syncStorage = new MemoryBlockstore()
  })

  let syncRepo: Repo

  it('syncs an empty repo', async () => {
    const car = await streamToBuffer(sync.getFullRepo(storage, repo.cid))
    const loaded = await sync.loadFullRepo(
      syncStorage,
      car,
      repoDid,
      keypair.did(),
    )
    syncRepo = await Repo.load(syncStorage, loaded.root)
    const data = await syncRepo.data.list(10)
    expect(data.length).toBe(0)
  })

  it('syncs a repo that is starting from scratch', async () => {
    const filled = await util.fillRepo(repo, keypair, 100)
    repo = filled.repo
    repoData = filled.data

    const car = await streamToBuffer(sync.getFullRepo(storage, repo.cid))
    const loaded = await sync.loadFullRepo(
      syncStorage,
      car,
      repoDid,
      keypair.did(),
    )
    syncRepo = await Repo.load(syncStorage, loaded.root)
    const contents = await syncRepo.getContents()
    expect(contents).toEqual(repoData)
    await util.verifyRepoDiff(loaded.writeLog, {}, repoData)
  })

  it('syncs a repo that is behind', async () => {
    // add more to providers's repo & have consumer catch up
    const beforeData = structuredClone(repoData)
    const edited = await util.editRepo(repo, repoData, keypair, {
      adds: 20,
      updates: 20,
      deletes: 20,
    })
    repo = edited.repo
    repoData = edited.data
    const diffCar = await streamToBuffer(
      sync.getCommits(storage, repo.cid, syncRepo.cid),
    )
    const loaded = await sync.loadDiff(
      syncRepo,
      diffCar,
      repoDid,
      keypair.did(),
    )
    syncRepo = await Repo.load(syncStorage, loaded.root)
    const contents = await syncRepo.getContents()
    expect(contents).toEqual(repoData)
    await util.verifyRepoDiff(loaded.writeLog, beforeData, repoData)
  })

  it('throws on a bad signature', async () => {
    const badRepo = await util.addBadCommit(repo, keypair)
    const diffCar = await streamToBuffer(
      sync.getCommits(storage, badRepo.cid, syncRepo.cid),
    )
    await expect(
      sync.loadDiff(syncRepo, diffCar, repoDid, keypair.did()),
    ).rejects.toThrow('Invalid signature on commit')
  })
})
