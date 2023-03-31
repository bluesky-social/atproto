import AtpAgent from '@atproto/api'
import { TID } from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import * as repo from '@atproto/repo'
import { collapseWriteLog, MemoryBlockstore, readCar } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import { AppContext } from '../../src'
import { CloseFn, runTestServer } from '../_util'
import { SeedClient } from '../seeds/client'

describe('repo sync', () => {
  let agent: AtpAgent
  let sc: SeedClient
  let did: string

  const repoData: repo.RepoContents = {}
  const uris: AtUri[] = []
  const storage = new MemoryBlockstore()
  let currRoot: CID | undefined
  let ctx: AppContext

  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'repo_sync',
    })
    ctx = server.ctx
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    did = sc.dids.alice
    agent.api.setHeader('authorization', `Bearer ${sc.accounts[did].accessJwt}`)
  })

  afterAll(async () => {
    await close()
  })

  it('creates and syncs some records', async () => {
    const ADD_COUNT = 10
    for (let i = 0; i < ADD_COUNT; i++) {
      const { obj, uri } = await makePost(sc, did)
      if (!repoData[uri.collection]) {
        repoData[uri.collection] = {}
      }
      repoData[uri.collection][uri.rkey] = obj
      uris.push(uri)
    }

    const car = await agent.api.com.atproto.sync.getRepo({ did })
    const synced = await repo.loadFullRepo(
      storage,
      new Uint8Array(car.data),
      did,
      ctx.repoSigningKey.did(),
    )
    expect(synced.writeLog.length).toBe(ADD_COUNT + 1) // +1 because of repo
    const ops = await collapseWriteLog(synced.writeLog)
    expect(ops.length).toBe(ADD_COUNT) // Does not include empty initial commit
    const loaded = await repo.Repo.load(storage, synced.root)
    const contents = await loaded.getContents()
    expect(contents).toEqual(repoData)

    currRoot = synced.root
  })

  it('syncs creates and deletes', async () => {
    const ADD_COUNT = 10
    const DEL_COUNT = 4
    for (let i = 0; i < ADD_COUNT; i++) {
      const { obj, uri } = await makePost(sc, did)
      if (!repoData[uri.collection]) {
        repoData[uri.collection] = {}
      }
      repoData[uri.collection][uri.rkey] = obj
      uris.push(uri)
    }
    // delete two that are already sync & two that have not been
    for (let i = 0; i < DEL_COUNT; i++) {
      const uri = uris[i * 5]
      await agent.api.app.bsky.feed.post.delete({
        repo: did,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      delete repoData[uri.collection][uri.rkey]
    }

    const car = await agent.api.com.atproto.sync.getRepo({
      did,
      earliest: currRoot?.toString(),
    })
    const currRepo = await repo.Repo.load(storage, currRoot)
    const synced = await repo.loadDiff(
      currRepo,
      new Uint8Array(car.data),
      did,
      ctx.repoSigningKey.did(),
    )
    expect(synced.writeLog.length).toBe(ADD_COUNT + DEL_COUNT)
    const ops = await collapseWriteLog(synced.writeLog)
    expect(ops.length).toBe(ADD_COUNT) // -2 because of dels of new records, +2 because of dels of old records
    const loaded = await repo.Repo.load(storage, synced.root)
    const contents = await loaded.getContents()
    expect(contents).toEqual(repoData)

    currRoot = synced.root
  })

  it('syncs current root', async () => {
    const root = await agent.api.com.atproto.sync.getHead({ did })
    expect(root.data.root).toEqual(currRoot?.toString())
  })

  it('syncs commit path', async () => {
    const local = await storage.getCommitPath(currRoot as CID, null)
    if (!local) {
      throw new Error('Could not get local commit path')
    }
    const localStr = local.map((c) => c.toString())
    const commitPath = await agent.api.com.atproto.sync.getCommitPath({ did })
    expect(commitPath.data.commits).toEqual(localStr)

    const partialCommitPath = await agent.api.com.atproto.sync.getCommitPath({
      did,
      earliest: localStr[2],
      latest: localStr[15],
    })
    expect(partialCommitPath.data.commits).toEqual(localStr.slice(3, 16))
  })

  it('syncs commit range', async () => {
    const local = await storage.getCommits(currRoot as CID, null)
    if (!local) {
      throw new Error('Could not get local commit path')
    }
    const memoryStore = new MemoryBlockstore()
    // first we load some baseline data (needed for parsing range)
    const first = await agent.api.com.atproto.sync.getRepo({
      did,
      latest: local[2].commit.toString(),
    })
    const firstParsed = await repo.readCar(new Uint8Array(first.data))
    memoryStore.putMany(firstParsed.blocks)

    // then we load some commit range
    const second = await agent.api.com.atproto.sync.getRepo({
      did,
      earliest: local[2].commit.toString(),
      latest: local[15].commit.toString(),
    })
    const secondParsed = await repo.readCar(new Uint8Array(second.data))
    memoryStore.putMany(secondParsed.blocks)

    // then we verify we have all the commits in the range
    const commits = await memoryStore.getCommits(
      local[15].commit,
      local[2].commit,
    )
    if (!commits) {
      throw new Error('expected commits to be defined')
    }
    const localSlice = local.slice(2, 15)
    expect(commits.length).toBe(localSlice.length)
    for (let i = 0; i < commits.length; i++) {
      const fromRemote = commits[i]
      const fromLocal = localSlice[i]
      expect(fromRemote.commit.equals(fromLocal.commit))
      expect(fromRemote.blocks.equals(fromLocal.blocks))
    }
  })

  it('sync a repo checkout', async () => {
    const car = await agent.api.com.atproto.sync.getCheckout({ did })
    const checkoutStorage = new MemoryBlockstore()
    const loaded = await repo.loadCheckout(
      checkoutStorage,
      new Uint8Array(car.data),
      did,
      ctx.repoSigningKey.did(),
    )
    expect(loaded.contents).toEqual(repoData)
    const loadedRepo = await repo.Repo.load(checkoutStorage, loaded.root)
    expect(await loadedRepo.getContents()).toEqual(repoData)
  })

  it('sync a record proof', async () => {
    const collection = Object.keys(repoData)[0]
    const rkey = Object.keys(repoData[collection])[0]
    const car = await agent.api.com.atproto.sync.getRecord({
      did,
      collection,
      rkey,
    })
    const records = await repo.verifyRecords(
      new Uint8Array(car.data),
      did,
      ctx.repoSigningKey.did(),
    )
    const claim = {
      collection,
      rkey,
      record: repoData[collection][rkey],
    }
    expect(records.length).toBe(1)
    expect(records[0].record).toEqual(claim.record)
    const result = await repo.verifyProofs(
      new Uint8Array(car.data),
      [claim],
      did,
      ctx.repoSigningKey.did(),
    )
    expect(result.verified.length).toBe(1)
    expect(result.unverified.length).toBe(0)
  })

  it('sync a proof of non-existence', async () => {
    const collection = Object.keys(repoData)[0]
    const rkey = TID.nextStr() // rkey that doesn't exist
    const car = await agent.api.com.atproto.sync.getRecord({
      did,
      collection,
      rkey,
    })
    const claim = {
      collection,
      rkey,
      record: null,
    }
    const result = await repo.verifyProofs(
      new Uint8Array(car.data),
      [claim],
      did,
      ctx.repoSigningKey.did(),
    )
    expect(result.verified.length).toBe(1)
    expect(result.unverified.length).toBe(0)
  })

  it('sync blocks', async () => {
    // let's just get some cids to reference
    const collection = Object.keys(repoData)[0]
    const rkey = Object.keys(repoData[collection])[0]
    const proofCar = await agent.api.com.atproto.sync.getRecord({
      did,
      collection,
      rkey,
    })
    const proofBlocks = await readCar(new Uint8Array(proofCar.data))
    const cids = proofBlocks.blocks.entries().map((e) => e.cid.toString())
    const res = await agent.api.com.atproto.sync.getBlocks({
      did,
      cids,
    })
    const car = await readCar(new Uint8Array(res.data))
    expect(car.roots.length).toBe(0)
    expect(car.blocks.equals(proofBlocks.blocks))
  })

  it('syncs images', async () => {
    const img1 = await sc.uploadFile(
      did,
      'tests/image/fixtures/key-landscape-small.jpg',
      'image/jpeg',
    )
    const img2 = await sc.uploadFile(
      did,
      'tests/image/fixtures/key-portrait-small.jpg',
      'image/jpeg',
    )
    await sc.post(did, 'blah', undefined, [img1])
    await sc.post(did, 'blah', undefined, [img1, img2])
    await sc.post(did, 'blah', undefined, [img2])
    const res = await agent.api.com.atproto.sync.getCommitPath({ did })
    const commits = res.data.commits
    const blobsForFirst = await agent.api.com.atproto.sync.listBlobs({
      did,
      earliest: commits.at(-4),
      latest: commits.at(-3),
    })
    const blobsForSecond = await agent.api.com.atproto.sync.listBlobs({
      did,
      earliest: commits.at(-3),
      latest: commits.at(-2),
    })
    const blobsForThird = await agent.api.com.atproto.sync.listBlobs({
      did,
      earliest: commits.at(-2),
      latest: commits.at(-1),
    })
    const blobsForRange = await agent.api.com.atproto.sync.listBlobs({
      did,
      earliest: commits.at(-4),
    })
    const blobsForRepo = await agent.api.com.atproto.sync.listBlobs({
      did,
    })
    const cid1 = img1.image.ref.toString()
    const cid2 = img2.image.ref.toString()

    expect(blobsForFirst.data.cids).toEqual([cid1])
    expect(blobsForSecond.data.cids.sort()).toEqual([cid1, cid2].sort())
    expect(blobsForThird.data.cids).toEqual([cid2])
    expect(blobsForRange.data.cids.sort()).toEqual([cid1, cid2].sort())
    expect(blobsForRepo.data.cids.sort()).toEqual([cid1, cid2].sort())
  })
})

const makePost = async (sc: SeedClient, did: string) => {
  const res = await sc.post(did, randomStr(32, 'base32'))
  const uri = res.ref.uri
  const record = await sc.agent.api.com.atproto.repo.getRecord({
    repo: did,
    collection: uri.collection,
    rkey: uri.rkey,
  })
  return {
    uri,
    obj: record.data.value,
  }
}
