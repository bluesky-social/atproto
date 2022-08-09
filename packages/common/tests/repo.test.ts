import * as auth from '@adxp/auth'

import { Repo } from '../src/repo'
import IpldStore from '../src/blockstore/ipld-store'
import * as util from './_util'

describe('Repo', () => {
  let blockstore: IpldStore
  let authStore: auth.AuthStore
  let repo: Repo
  let postData: util.RepoData
  let likeData: util.RepoData

  it('creates repo', async () => {
    blockstore = IpldStore.createInMemory()
    authStore = await auth.MemoryStore.load()
    await authStore.claimFull()
    repo = await Repo.create(blockstore, await authStore.did(), authStore)
  })

  it('adds content within a given collection', async () => {
    postData = await util.fillRepo(repo, { 'bsky/posts': 100 })
    await util.checkRepo(repo, postData)
  })

  it('adds content within another collection', async () => {
    likeData = await util.fillRepo(repo, { 'bsky/likes': 100 })
    await util.checkRepo(repo, likeData)
  })

  it('adds a valid signature to commit', async () => {
    const commit = await repo.getCommit()
    const verified = await auth.verifySignature(
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
    const reloadedRepo = await Repo.load(blockstore, repo.cid, authStore)

    await util.checkRepo(reloadedRepo, postData)
    await util.checkRepo(reloadedRepo, likeData)
  })
})
