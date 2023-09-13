import AtpAgent from '@atproto/api'
import { TID } from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import * as repo from '@atproto/repo'
import { MemoryBlockstore } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { CID } from 'multiformats/cid'
import { AppContext } from '../../src'
import { adminAuth, CloseFn, runTestServer } from '../_util'
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

    const carRes = await agent.api.com.atproto.sync.getRepo({ did })
    const car = await repo.readCarWithRoot(carRes.data)
    const synced = await repo.verifyRepo(
      car.blocks,
      car.root,
      did,
      ctx.repoSigningKey.did(),
    )
    await storage.applyCommit(synced.commit)
    expect(synced.creates.length).toBe(ADD_COUNT)
    const loaded = await repo.Repo.load(storage, car.root)
    const contents = await loaded.getContents()
    expect(contents).toEqual(repoData)

    currRoot = car.root
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

    const carRes = await agent.api.com.atproto.sync.getRepo({ did })
    const car = await repo.readCarWithRoot(carRes.data)
    const currRepo = await repo.Repo.load(storage, currRoot)
    const synced = await repo.verifyDiff(
      currRepo,
      car.blocks,
      car.root,
      did,
      ctx.repoSigningKey.did(),
    )
    expect(synced.writes.length).toBe(ADD_COUNT) // -2 because of dels of new records, +2 because of dels of old records
    await storage.applyCommit(synced.commit)
    const loaded = await repo.Repo.load(storage, car.root)
    const contents = await loaded.getContents()
    expect(contents).toEqual(repoData)

    currRoot = car.root
  })

  it('syncs latest repo commit', async () => {
    const commit = await agent.api.com.atproto.sync.getLatestCommit({ did })
    expect(commit.data.cid).toEqual(currRoot?.toString())
  })

  it('syncs `since` a given rev', async () => {
    const repoBefore = await repo.Repo.load(storage, currRoot)

    // add a post
    const { obj, uri } = await makePost(sc, did)
    if (!repoData[uri.collection]) {
      repoData[uri.collection] = {}
    }
    repoData[uri.collection][uri.rkey] = obj
    uris.push(uri)

    const carRes = await agent.api.com.atproto.sync.getRepo({
      did,
      since: repoBefore.commit.rev,
    })
    const car = await repo.readCarWithRoot(carRes.data)
    expect(car.blocks.size).toBeLessThan(10) // should only contain new blocks
    const synced = await repo.verifyDiff(
      repoBefore,
      car.blocks,
      car.root,
      did,
      ctx.repoSigningKey.did(),
    )
    expect(synced.writes.length).toBe(1)
    await storage.applyCommit(synced.commit)
    const loaded = await repo.Repo.load(storage, car.root)
    const contents = await loaded.getContents()
    expect(contents).toEqual(repoData)

    currRoot = car.root
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

  describe('repo takedown', () => {
    beforeAll(async () => {
      await sc.takeModerationAction({
        action: TAKEDOWN,
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did,
        },
      })
      agent.api.xrpc.unsetHeader('authorization')
    })

    it('does not sync repo unauthed', async () => {
      const tryGetRepo = agent.api.com.atproto.sync.getRepo({ did })
      await expect(tryGetRepo).rejects.toThrow(/Could not find repo for DID/)
    })

    it('syncs repo to owner or admin', async () => {
      const tryGetRepoOwner = agent.api.com.atproto.sync.getRepo(
        { did },
        { headers: { authorization: `Bearer ${sc.accounts[did].accessJwt}` } },
      )
      await expect(tryGetRepoOwner).resolves.toBeDefined()
      const tryGetRepoAdmin = agent.api.com.atproto.sync.getRepo(
        { did },
        { headers: { authorization: adminAuth() } },
      )
      await expect(tryGetRepoAdmin).resolves.toBeDefined()
    })

    it('does not sync latest commit unauthed', async () => {
      const tryGetLatest = agent.api.com.atproto.sync.getLatestCommit({ did })
      await expect(tryGetLatest).rejects.toThrow(/Could not find root for DID/)
    })

    it('does not sync a record proof unauthed', async () => {
      const collection = Object.keys(repoData)[0]
      const rkey = Object.keys(repoData[collection])[0]
      const tryGetRecord = agent.api.com.atproto.sync.getRecord({
        did,
        collection,
        rkey,
      })
      await expect(tryGetRecord).rejects.toThrow(/Could not find repo for DID/)
    })
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
