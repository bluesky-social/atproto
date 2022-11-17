import * as auth from '@atproto/auth'

import { Repo } from '../src/repo'
import { MemoryBlockstore } from '../src/blockstore'
import * as util from './_util'
import { TID } from '@atproto/common'

describe('Repo', () => {
  const verifier = new auth.Verifier()
  const collName = 'com.example.posts'

  let blockstore: MemoryBlockstore
  let authStore: auth.AuthStore
  let repo: Repo
  let repoData: util.RepoData

  it('creates repo', async () => {
    blockstore = new MemoryBlockstore()
    authStore = await verifier.createTempAuthStore()
    await authStore.claimFull()
    repo = await Repo.create(blockstore, await authStore.did(), authStore)
  })

  it('has proper metadata', async () => {
    expect(repo.meta.did).toEqual(await authStore.did())
    expect(repo.meta.version).toBe(1)
    expect(repo.meta.datastore).toBe('mst')
  })

  it('does basic operations', async () => {
    const rkey = TID.nextStr()
    const record = util.generateObject()
    repo = await repo
      .stageUpdate({
        action: 'create',
        collection: collName,
        rkey: rkey,
        value: record,
      })
      .createCommit(authStore)

    let got = await repo.getRecord(collName, rkey)
    expect(got).toEqual(record)

    const updatedRecord = util.generateObject()
    repo = await repo
      .stageUpdate({
        action: 'update',
        collection: collName,
        rkey: rkey,
        value: updatedRecord,
      })
      .createCommit(authStore)
    got = await repo.getRecord(collName, rkey)
    expect(got).toEqual(updatedRecord)

    repo = await repo
      .stageUpdate({
        action: 'delete',
        collection: collName,
        rkey: rkey,
      })
      .createCommit(authStore)
    got = await repo.getRecord(collName, rkey)
    expect(got).toBeNull()
  })

  it('adds content collections', async () => {
    const filled = await util.fillRepo(repo, authStore, 100)
    repo = filled.repo
    repoData = filled.data
    await util.checkRepo(repo, repoData)
  })

  it('edits and deletes content', async () => {
    const edited = await util.editRepo(repo, repoData, authStore, {
      adds: 20,
      updates: 20,
      deletes: 20,
    })
    repo = edited.repo
    await util.checkRepo(repo, repoData)
  })

  it('adds a valid signature to commit', async () => {
    const commit = await repo.commit
    const verified = await verifier.verifySignature(
      repo.did,
      commit.root.bytes,
      commit.sig,
    )
    expect(verified).toBeTruthy()
  })

  it('sets correct DID', async () => {
    expect(repo.did).toEqual(await authStore.did())
  })

  it('loads from blockstore', async () => {
    const reloadedRepo = await Repo.load(blockstore, repo.cid)

    await util.checkRepo(reloadedRepo, repoData)
    expect(repo.meta.did).toEqual(await authStore.did())
    expect(repo.meta.version).toBe(1)
    expect(repo.meta.datastore).toBe('mst')
  })
})
