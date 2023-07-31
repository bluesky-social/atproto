import fs from 'fs/promises'
import { AtUri } from '@atproto/uri'
import AtpAgent from '@atproto/api'
import * as createRecord from '@atproto/api/src/client/types/com/atproto/repo/createRecord'
import * as putRecord from '@atproto/api/src/client/types/com/atproto/repo/putRecord'
import * as deleteRecord from '@atproto/api/src/client/types/com/atproto/repo/deleteRecord'
import * as applyWrites from '@atproto/api/src/client/types/com/atproto/repo/applyWrites'
import { cidForCbor, TID } from '@atproto/common'
import { BlobNotFoundError } from '@atproto/repo'
import { defaultFetchHandler } from '@atproto/xrpc'
import * as Post from '../src/lexicon/types/app/bsky/feed/post'
import { adminAuth, CloseFn, paginateAll, runTestServer } from './_util'
import AppContext from '../src/context'
import { TAKEDOWN } from '../src/lexicon/types/com/atproto/admin/defs'
import { BlobRef } from '@atproto/lexicon'
import { ids } from '../src/lexicon/lexicons'

const alice = {
  email: 'alice@test.com',
  handle: 'alice.test',
  did: '',
  password: 'alice-pass',
}
const bob = {
  email: 'bob@test.com',
  handle: 'bob.test',
  did: '',
  password: 'bob-pass',
}

describe('crud operations', () => {
  let ctx: AppContext
  let agent: AtpAgent
  let aliceAgent: AtpAgent
  let bobAgent: AtpAgent
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'crud',
    })
    ctx = server.ctx
    close = server.close
    agent = new AtpAgent({ service: server.url })
    aliceAgent = new AtpAgent({ service: server.url })
    bobAgent = new AtpAgent({ service: server.url })
  })

  afterAll(async () => {
    await close()
  })

  it('registers users', async () => {
    const res = await agent.api.com.atproto.server.createAccount({
      email: alice.email,
      handle: alice.handle,
      password: alice.password,
    })
    aliceAgent.api.setHeader('authorization', `Bearer ${res.data.accessJwt}`)
    alice.did = res.data.did
    const res2 = await agent.api.com.atproto.server.createAccount({
      email: bob.email,
      handle: bob.handle,
      password: bob.password,
    })
    bobAgent.api.setHeader('authorization', `Bearer ${res2.data.accessJwt}`)
    bob.did = res2.data.did
  })

  it('describes repo', async () => {
    const description = await agent.api.com.atproto.repo.describeRepo({
      repo: alice.did,
    })
    expect(description.data.handle).toBe(alice.handle)
    expect(description.data.did).toBe(alice.did)
    const description2 = await agent.api.com.atproto.repo.describeRepo({
      repo: bob.did,
    })
    expect(description2.data.handle).toBe(bob.handle)
    expect(description2.data.did).toBe(bob.did)
  })

  let uri: AtUri
  it('creates records', async () => {
    const res = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      },
    })
    uri = new AtUri(res.data.uri)
    expect(res.data.uri).toBe(
      `at://${alice.did}/app.bsky.feed.post/${uri.rkey}`,
    )
  })

  it('lists records', async () => {
    const res1 = await agent.api.com.atproto.repo.listRecords({
      repo: alice.did,
      collection: 'app.bsky.feed.post',
    })
    expect(res1.data.records.length).toBe(1)
    expect(res1.data.records[0].uri).toBe(uri.toString())
    expect((res1.data.records[0].value as Post.Record).text).toBe(
      'Hello, world!',
    )

    const res2 = await agent.api.app.bsky.feed.post.list({
      repo: alice.did,
    })
    expect(res2.records.length).toBe(1)
    expect(res2.records[0].uri).toBe(uri.toString())
    expect(res2.records[0].value.text).toBe('Hello, world!')
  })

  it('gets records', async () => {
    const res1 = await agent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.post',
      rkey: uri.rkey,
    })
    expect(res1.data.uri).toBe(uri.toString())
    expect((res1.data.value as Post.Record).text).toBe('Hello, world!')

    const res2 = await agent.api.app.bsky.feed.post.get({
      repo: alice.did,
      rkey: uri.rkey,
    })
    expect(res2.uri).toBe(uri.toString())
    expect(res2.value.text).toBe('Hello, world!')
  })

  it('deletes records', async () => {
    await aliceAgent.api.com.atproto.repo.deleteRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.post',
      rkey: uri.rkey,
    })
    const res1 = await agent.api.com.atproto.repo.listRecords({
      repo: alice.did,
      collection: 'app.bsky.feed.post',
    })
    expect(res1.data.records.length).toBe(0)
  })

  it('CRUDs records with the semantic sugars', async () => {
    const res1 = await aliceAgent.api.app.bsky.feed.post.create(
      { repo: alice.did },
      {
        $type: 'app.bsky.feed.post',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      },
    )
    const uri = new AtUri(res1.uri)

    const res2 = await agent.api.app.bsky.feed.post.list({
      repo: alice.did,
    })
    expect(res2.records.length).toBe(1)

    await aliceAgent.api.app.bsky.feed.post.delete({
      repo: alice.did,
      rkey: uri.rkey,
    })

    const res3 = await agent.api.app.bsky.feed.post.list({
      repo: alice.did,
    })
    expect(res3.records.length).toBe(0)
  })

  it('attaches images to a post', async () => {
    const file = await fs.readFile(
      'tests/image/fixtures/key-landscape-small.jpg',
    )
    const uploadedRes = await aliceAgent.api.com.atproto.repo.uploadBlob(file, {
      encoding: 'image/jpeg',
    })
    const uploaded = uploadedRes.data.blob
    // Expect blobstore not to have image yet
    await expect(ctx.blobstore.getBytes(uploaded.ref)).rejects.toThrow(
      BlobNotFoundError,
    )
    // Associate image with post, image should be placed in blobstore
    const res = await aliceAgent.api.app.bsky.feed.post.create(
      { repo: alice.did },
      {
        $type: 'app.bsky.feed.post',
        text: "Here's a key!",
        createdAt: new Date().toISOString(),
        embed: {
          $type: 'app.bsky.embed.images',
          images: [{ image: uploaded, alt: '' }],
        },
      },
    )
    // Ensure image is on post record
    const postUri = new AtUri(res.uri)
    const post = await aliceAgent.api.app.bsky.feed.post.get({
      rkey: postUri.rkey,
      repo: alice.did,
    })
    const images = post.value.embed?.images as { image: BlobRef }[]
    expect(images.length).toEqual(1)
    expect(uploaded.ref.equals(images[0].image.ref)).toBeTruthy()
    // Ensure that the uploaded image is now in the blobstore, i.e. doesn't throw BlobNotFoundError
    await ctx.blobstore.getBytes(uploaded.ref)
    // Cleanup
    await aliceAgent.api.app.bsky.feed.post.delete({
      rkey: postUri.rkey,
      repo: alice.did,
    })
  })

  it('creates records with the correct key described by the schema', async () => {
    const res1 = await aliceAgent.api.app.bsky.actor.profile.create(
      { repo: alice.did },
      {
        displayName: 'alice',
        createdAt: new Date().toISOString(),
      },
    )
    const uri = new AtUri(res1.uri)
    expect(uri.rkey).toBe('self')
  })

  describe('paginates', () => {
    let uri1: AtUri
    let uri2: AtUri
    let uri3: AtUri
    let uri4: AtUri
    let uri5: AtUri

    beforeAll(async () => {
      const createPost = async (text: string) => {
        const res = await aliceAgent.api.app.bsky.feed.post.create(
          { repo: alice.did },
          {
            $type: 'app.bsky.feed.post',
            text,
            createdAt: new Date().toISOString(),
          },
        )
        return new AtUri(res.uri)
      }
      uri1 = await createPost('Post 1')
      uri2 = await createPost('Post 2')
      uri3 = await createPost('Post 3')
      uri4 = await createPost('Post 4')
      uri5 = await createPost('Post 5')
    })

    afterAll(async () => {
      for (const uri of [uri1, uri2, uri3, uri4, uri5]) {
        await aliceAgent.api.app.bsky.feed.post.delete({
          repo: alice.did,
          rkey: uri.rkey,
        })
      }
    })

    it('in forwards order', async () => {
      const results = (results) => results.flatMap((res) => res.records)
      const paginator = async (cursor?: string) => {
        const res = await agent.api.app.bsky.feed.post.list({
          repo: alice.did,
          cursor,
          limit: 2,
        })
        return res
      }

      const paginatedAll = await paginateAll(paginator)
      paginatedAll.forEach((res) =>
        expect(res.records.length).toBeLessThanOrEqual(2),
      )

      const full = await agent.api.app.bsky.feed.post.list({
        repo: alice.did,
      })

      expect(full.records.length).toEqual(5)
      expect(results(paginatedAll)).toEqual(results([full]))
    })

    it('in reverse order', async () => {
      const results = (results) => results.flatMap((res) => res.records)
      const paginator = async (cursor?: string) => {
        const res = await agent.api.app.bsky.feed.post.list({
          repo: alice.did,
          reverse: true,
          cursor,
          limit: 2,
        })
        return res
      }

      const paginatedAll = await paginateAll(paginator)
      paginatedAll.forEach((res) =>
        expect(res.records.length).toBeLessThanOrEqual(2),
      )

      const full = await agent.api.app.bsky.feed.post.list({
        repo: alice.did,
        reverse: true,
      })

      expect(full.records.length).toEqual(5)
      expect(results(paginatedAll)).toEqual(results([full]))
    })

    it('reverses', async () => {
      const forwards = await agent.api.app.bsky.feed.post.list({
        repo: alice.did,
      })
      const reverse = await agent.api.app.bsky.feed.post.list({
        repo: alice.did,
        reverse: true,
      })
      expect(forwards.cursor).toEqual(uri1.rkey)
      expect(reverse.cursor).toEqual(uri5.rkey)
      expect(forwards.records.length).toEqual(5)
      expect(reverse.records.length).toEqual(5)
      expect(forwards.records.reverse()).toEqual(reverse.records)
    })
  })

  describe('deleteRecord', () => {
    it('deletes a record if it exists', async () => {
      const { repo } = aliceAgent.api.com.atproto
      const { data: post } = await repo.createRecord({
        repo: alice.did,
        collection: ids.AppBskyFeedPost,
        record: { text: 'post', createdAt: new Date().toISOString() },
      })
      const uri = new AtUri(post.uri)
      await repo.deleteRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      const checkPost = repo.getRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      await expect(checkPost).rejects.toThrow('Could not locate record')
    })

    it("no-ops if record doesn't exist", async () => {
      const { repo } = aliceAgent.api.com.atproto
      const { data: post } = await repo.createRecord({
        repo: alice.did,
        collection: ids.AppBskyFeedPost,
        record: { text: 'post', createdAt: new Date().toISOString() },
      })
      const uri = new AtUri(post.uri)
      await repo.deleteRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      const checkPost = repo.getRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      await expect(checkPost).rejects.toThrow('Could not locate record')
      const attemptDelete = repo.deleteRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      await expect(attemptDelete).resolves.toBeDefined()
    })
  })

  describe('putRecord', () => {
    const profilePath = {
      collection: ids.AppBskyActorProfile,
      rkey: 'self',
    }

    it("creates a new record if it doesn't already exist", async () => {
      const { repo } = bobAgent.api.com.atproto
      const exists = repo.getRecord({ ...profilePath, repo: bob.did })
      await expect(exists).rejects.toThrow('Could not locate record')

      const { data: put } = await repo.putRecord({
        ...profilePath,
        repo: bob.did,
        record: {
          displayName: 'Robert',
        },
      })
      expect(put.uri).toEqual(`at://${bob.did}/${ids.AppBskyActorProfile}/self`)

      const { data: profile } = await repo.getRecord({
        ...profilePath,
        repo: bob.did,
      })
      expect(profile.value).toEqual({
        $type: ids.AppBskyActorProfile,
        displayName: 'Robert',
      })
    })

    it('updates a record if it already exists', async () => {
      const { repo } = bobAgent.api.com.atproto
      const { data: put } = await repo.putRecord({
        ...profilePath,
        repo: bob.did,
        record: {
          displayName: 'Robert',
          description: 'Dog lover',
        },
      })
      expect(put.uri).toEqual(`at://${bob.did}/${ids.AppBskyActorProfile}/self`)

      const { data: profile } = await repo.getRecord({
        ...profilePath,
        repo: bob.did,
      })
      expect(profile.value).toEqual({
        $type: ids.AppBskyActorProfile,
        displayName: 'Robert',
        description: 'Dog lover',
      })
    })

    it('temporarily only allows updates to profile', async () => {
      const { repo } = bobAgent.api.com.atproto
      const put = await repo.putRecord({
        repo: bob.did,
        collection: ids.AppBskyGraphFollow,
        rkey: TID.nextStr(),
        record: {
          subject: alice.did,
          createdAt: new Date().toISOString(),
        },
      })
      const edit = repo.putRecord({
        repo: bob.did,
        collection: ids.AppBskyGraphFollow,
        rkey: new AtUri(put.data.uri).rkey,
        record: {
          subject: bob.did,
          createdAt: new Date().toISOString(),
        },
      })

      await expect(edit).rejects.toThrow(
        'Temporarily only accepting updates for collections: app.bsky.actor.profile, app.bsky.graph.list, app.bsky.feed.generator',
      )
    })

    it('fails on user mismatch', async () => {
      const { repo } = aliceAgent.api.com.atproto
      const put = repo.putRecord({
        repo: bob.did,
        collection: ids.AppBskyGraphFollow,
        rkey: TID.nextStr(),
        record: {
          subject: alice.did,
          createdAt: new Date().toISOString(),
        },
      })
      await expect(put).rejects.toThrow('Authentication Required')
    })

    it('fails on invalid record', async () => {
      const { repo } = bobAgent.api.com.atproto
      const put = repo.putRecord({
        ...profilePath,
        repo: bob.did,
        record: {
          displayName: 'Robert',
          description: 3.141,
        },
      })
      await expect(put).rejects.toThrow(
        'Invalid app.bsky.actor.profile record: Record/description must be a string',
      )
      const { data: profile } = await repo.getRecord({
        ...profilePath,
        repo: bob.did,
      })
      expect(profile.value).toEqual({
        $type: ids.AppBskyActorProfile,
        displayName: 'Robert',
        description: 'Dog lover',
      })
    })
  })

  // Validation
  // --------------

  it('defaults an undefined $type on records', async () => {
    const res = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'blah',
        createdAt: new Date().toISOString(),
      },
    })
    const uri = new AtUri(res.data.uri)
    const got = await agent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: uri.collection,
      rkey: uri.rkey,
    })
    expect(got.data.value['$type']).toBe(uri.collection)
  })

  it('requires the schema to be known if validating', async () => {
    const prom = aliceAgent.api.com.atproto.repo.createRecord({
      repo: alice.did,
      collection: 'com.example.foobar',
      record: { $type: 'com.example.foobar' },
    })
    await expect(prom).rejects.toThrow(
      'Lexicon not found: lex:com.example.foobar',
    )
  })

  it('requires the $type to match the schema', async () => {
    await expect(
      aliceAgent.api.com.atproto.repo.createRecord({
        repo: alice.did,
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.like' },
      }),
    ).rejects.toThrow(
      'Invalid $type: expected app.bsky.feed.post, got app.bsky.feed.like',
    )
  })

  it('validates the record on write', async () => {
    await expect(
      aliceAgent.api.com.atproto.repo.createRecord({
        repo: alice.did,
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.post' },
      }),
    ).rejects.toThrow(
      'Invalid app.bsky.feed.post record: Record must have the property "text"',
    )
  })

  describe('compare-and-swap', () => {
    let recordCount = 0 // Ensures unique cids
    const postRecord = () => ({
      text: `post (${++recordCount})`,
      createdAt: new Date().toISOString(),
    })
    const profileRecord = () => ({
      displayName: `ali (${++recordCount})`,
    })

    it('createRecord succeeds on proper commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: head } = await sync.getHead({ did: alice.did })
      const { data: post } = await repo.createRecord({
        repo: alice.did,
        collection: ids.AppBskyFeedPost,
        swapCommit: head.root,
        record: postRecord(),
      })
      const uri = new AtUri(post.uri)
      const checkPost = repo.getRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      await expect(checkPost).resolves.toBeDefined()
    })

    it('createRecord fails on bad commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: staleHead } = await sync.getHead({ did: alice.did })
      // Update repo, change head
      await repo.createRecord({
        repo: alice.did,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const attemptCreate = repo.createRecord({
        repo: alice.did,
        collection: ids.AppBskyFeedPost,
        swapCommit: staleHead.root,
        record: postRecord(),
      })
      await expect(attemptCreate).rejects.toThrow(createRecord.InvalidSwapError)
    })

    it('deleteRecord succeeds on proper commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: post } = await repo.createRecord({
        repo: alice.did,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const { data: head } = await sync.getHead({ did: alice.did })
      const uri = new AtUri(post.uri)
      await repo.deleteRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
        swapCommit: head.root,
      })
      const checkPost = repo.getRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      await expect(checkPost).rejects.toThrow('Could not locate record')
    })

    it('deleteRecord fails on bad commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: staleHead } = await sync.getHead({ did: alice.did })
      const { data: post } = await repo.createRecord({
        repo: alice.did,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const uri = new AtUri(post.uri)
      const attemptDelete = repo.deleteRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
        swapCommit: staleHead.root,
      })
      await expect(attemptDelete).rejects.toThrow(deleteRecord.InvalidSwapError)
      const checkPost = repo.getRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      await expect(checkPost).resolves.toBeDefined()
    })

    it('deleteRecord succeeds on proper record cas', async () => {
      const { repo } = aliceAgent.api.com.atproto
      const { data: post } = await repo.createRecord({
        repo: alice.did,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const uri = new AtUri(post.uri)
      await repo.deleteRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
        swapRecord: post.cid,
      })
      const checkPost = repo.getRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      await expect(checkPost).rejects.toThrow('Could not locate record')
    })

    it('deleteRecord fails on bad record cas', async () => {
      const { repo } = aliceAgent.api.com.atproto
      const { data: post } = await repo.createRecord({
        repo: alice.did,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const uri = new AtUri(post.uri)
      const attemptDelete = repo.deleteRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
        swapRecord: (await cidForCbor({})).toString(),
      })
      await expect(attemptDelete).rejects.toThrow(deleteRecord.InvalidSwapError)
      const checkPost = repo.getRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      await expect(checkPost).resolves.toBeDefined()
    })

    it('putRecord succeeds on proper commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: head } = await sync.getHead({ did: alice.did })
      const { data: profile } = await repo.putRecord({
        repo: alice.did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapCommit: head.root,
        record: profileRecord(),
      })
      const { data: checkProfile } = await repo.getRecord({
        repo: alice.did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
      })
      expect(checkProfile.cid).toEqual(profile.cid)
    })

    it('putRecord fails on bad commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: staleHead } = await sync.getHead({ did: alice.did })
      // Update repo, change head
      await repo.createRecord({
        repo: alice.did,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const attemptPut = repo.putRecord({
        repo: alice.did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapCommit: staleHead.root,
        record: profileRecord(),
      })
      await expect(attemptPut).rejects.toThrow(putRecord.InvalidSwapError)
    })

    it('putRecord succeeds on proper record cas', async () => {
      const { repo } = aliceAgent.api.com.atproto
      // Start with missing profile record, to test swapRecord=null
      await repo.deleteRecord({
        repo: alice.did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
      })
      // Test swapRecord w/ null (ensures create)
      const { data: profile1 } = await repo.putRecord({
        repo: alice.did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapRecord: null,
        record: profileRecord(),
      })
      const { data: checkProfile1 } = await repo.getRecord({
        repo: alice.did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
      })
      expect(checkProfile1.cid).toEqual(profile1.cid)
      // Test swapRecord w/ cid (ensures update)
      const { data: profile2 } = await repo.putRecord({
        repo: alice.did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapRecord: profile1.cid,
        record: profileRecord(),
      })
      const { data: checkProfile2 } = await repo.getRecord({
        repo: alice.did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
      })
      expect(checkProfile2.cid).toEqual(profile2.cid)
    })

    it('putRecord fails on bad record cas', async () => {
      const { repo } = aliceAgent.api.com.atproto
      // Test swapRecord w/ null (ensures create)
      const attemptPut1 = repo.putRecord({
        repo: alice.did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapRecord: null,
        record: profileRecord(),
      })
      await expect(attemptPut1).rejects.toThrow(putRecord.InvalidSwapError)
      // Test swapRecord w/ cid (ensures update)
      const attemptPut2 = repo.putRecord({
        repo: alice.did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapRecord: (await cidForCbor({})).toString(),
        record: profileRecord(),
      })
      await expect(attemptPut2).rejects.toThrow(putRecord.InvalidSwapError)
    })

    it('applyWrites succeeds on proper commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: head } = await sync.getHead({ did: alice.did })
      await repo.applyWrites({
        repo: alice.did,
        swapCommit: head.root,
        writes: [
          {
            $type: `${ids.ComAtprotoRepoApplyWrites}#create`,
            action: 'create',
            collection: ids.AppBskyFeedPost,
            value: { $type: ids.AppBskyFeedPost, ...postRecord() },
          },
        ],
      })
    })

    it('applyWrites fails on bad commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: staleHead } = await sync.getHead({ did: alice.did })
      // Update repo, change head
      await repo.createRecord({
        repo: alice.did,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const attemptApplyWrite = repo.applyWrites({
        repo: alice.did,
        swapCommit: staleHead.root,
        writes: [
          {
            $type: `${ids.ComAtprotoRepoApplyWrites}#create`,
            action: 'create',
            collection: ids.AppBskyFeedPost,
            value: { $type: ids.AppBskyFeedPost, ...postRecord() },
          },
        ],
      })
      await expect(attemptApplyWrite).rejects.toThrow(
        applyWrites.InvalidSwapError,
      )
    })

    it("writes fail on values that can't reliably transform between cbor to lex", async () => {
      const passthroughBody = (data: unknown) =>
        typedArrayToBuffer(new TextEncoder().encode(JSON.stringify(data)))
      const result = await defaultFetchHandler(
        aliceAgent.service.origin + `/xrpc/com.atproto.repo.createRecord`,
        'post',
        { ...aliceAgent.api.xrpc.headers, 'Content-Type': 'application/json' },
        passthroughBody({
          repo: alice.did,
          collection: 'app.bsky.feed.post',
          record: {
            text: 'x',
            createdAt: new Date().toISOString(),
            deepObject: createDeepObject(4000),
          },
        }),
      )
      expect(result.status).toEqual(400)
      expect(result.body).toEqual({
        error: 'InvalidRequest',
        message: 'Bad record',
      })
    })
  })

  it('prevents duplicate likes', async () => {
    const now = new Date().toISOString()
    const uriA = AtUri.make(bob.did, 'app.bsky.feed.post', TID.nextStr())
    const cidA = await cidForCbor({ post: 'a' })
    const uriB = AtUri.make(bob.did, 'app.bsky.feed.post', TID.nextStr())
    const cidB = await cidForCbor({ post: 'b' })

    const { data: like1 } = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.like',
      record: {
        $type: 'app.bsky.feed.like',
        subject: { uri: uriA.toString(), cid: cidA.toString() },
        createdAt: now,
      },
    })
    const { data: like2 } = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.like',
      record: {
        $type: 'app.bsky.feed.like',
        subject: { uri: uriB.toString(), cid: cidB.toString() },
        createdAt: now,
      },
    })
    const { data: like3 } = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.like',
      record: {
        $type: 'app.bsky.feed.like',
        subject: { uri: uriA.toString(), cid: cidA.toString() },
        createdAt: now,
      },
    })

    const getLike1 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.like',
      rkey: new AtUri(like1.uri).rkey,
    })

    await expect(getLike1).rejects.toThrow('Could not locate record:')

    const getLike2 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.like',
      rkey: new AtUri(like2.uri).rkey,
    })

    await expect(getLike2).resolves.toBeDefined()

    const getLike3 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.like',
      rkey: new AtUri(like3.uri).rkey,
    })

    await expect(getLike3).resolves.toBeDefined()
  })

  it('prevents duplicate reposts', async () => {
    const now = new Date().toISOString()
    const uriA = AtUri.make(bob.did, 'app.bsky.feed.post', TID.nextStr())
    const cidA = await cidForCbor({ post: 'a' })
    const uriB = AtUri.make(bob.did, 'app.bsky.feed.post', TID.nextStr())
    const cidB = await cidForCbor({ post: 'b' })

    const { data: repost1 } =
      await aliceAgent.api.com.atproto.repo.createRecord({
        repo: alice.did,
        collection: 'app.bsky.feed.repost',
        record: {
          $type: 'app.bsky.feed.repost',
          subject: { uri: uriA.toString(), cid: cidA.toString() },
          createdAt: now,
        },
      })
    const { data: repost2 } =
      await aliceAgent.api.com.atproto.repo.createRecord({
        repo: alice.did,
        collection: 'app.bsky.feed.repost',
        record: {
          $type: 'app.bsky.feed.repost',
          subject: { uri: uriB.toString(), cid: cidB.toString() },
          createdAt: now,
        },
      })
    const { data: repost3 } =
      await aliceAgent.api.com.atproto.repo.createRecord({
        repo: alice.did,
        collection: 'app.bsky.feed.repost',
        record: {
          $type: 'app.bsky.feed.repost',
          subject: { uri: uriA.toString(), cid: cidA.toString() },
          createdAt: now,
        },
      })

    const getRepost1 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.repost',
      rkey: new AtUri(repost1.uri).rkey,
    })

    await expect(getRepost1).rejects.toThrow('Could not locate record:')

    const getRepost2 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.repost',
      rkey: new AtUri(repost2.uri).rkey,
    })

    await expect(getRepost2).resolves.toBeDefined()

    const getRepost3 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: 'app.bsky.feed.repost',
      rkey: new AtUri(repost3.uri).rkey,
    })

    await expect(getRepost3).resolves.toBeDefined()
  })

  it('prevents duplicate blocks', async () => {
    const now = new Date().toISOString()

    const { data: block1 } = await aliceAgent.api.com.atproto.repo.createRecord(
      {
        repo: alice.did,
        collection: 'app.bsky.graph.block',
        record: {
          $type: 'app.bsky.graph.block',
          subject: bob.did,
          createdAt: now,
        },
      },
    )

    const { data: block2 } = await bobAgent.api.com.atproto.repo.createRecord({
      repo: bob.did,
      collection: 'app.bsky.graph.block',
      record: {
        $type: 'app.bsky.graph.block',
        subject: alice.did,
        createdAt: now,
      },
    })

    const { data: block3 } = await aliceAgent.api.com.atproto.repo.createRecord(
      {
        repo: alice.did,
        collection: 'app.bsky.graph.block',
        record: {
          $type: 'app.bsky.graph.block',
          subject: bob.did,
          createdAt: now,
        },
      },
    )

    const getBlock1 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: 'app.bsky.graph.block',
      rkey: new AtUri(block1.uri).rkey,
    })

    await expect(getBlock1).rejects.toThrow('Could not locate record:')

    const getBlock2 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: bob.did,
      collection: 'app.bsky.graph.block',
      rkey: new AtUri(block2.uri).rkey,
    })

    await expect(getBlock2).resolves.toBeDefined()

    const getBlock3 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: 'app.bsky.graph.block',
      rkey: new AtUri(block3.uri).rkey,
    })

    await expect(getBlock3).resolves.toBeDefined()
  })

  it('prevents duplicate follows', async () => {
    const now = new Date().toISOString()

    const { data: follow1 } =
      await aliceAgent.api.com.atproto.repo.createRecord({
        repo: alice.did,
        collection: 'app.bsky.graph.follow',
        record: {
          $type: 'app.bsky.graph.follow',
          subject: bob.did,
          createdAt: now,
        },
      })
    const { data: follow2 } = await bobAgent.api.com.atproto.repo.createRecord({
      repo: bob.did,
      collection: 'app.bsky.graph.follow',
      record: {
        $type: 'app.bsky.graph.follow',
        subject: alice.did,
        createdAt: now,
      },
    })
    const { data: follow3 } =
      await aliceAgent.api.com.atproto.repo.createRecord({
        repo: alice.did,
        collection: 'app.bsky.graph.follow',
        record: {
          $type: 'app.bsky.graph.follow',
          subject: bob.did,
          createdAt: now,
        },
      })

    const getFollow1 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: 'app.bsky.graph.follow',
      rkey: new AtUri(follow1.uri).rkey,
    })

    await expect(getFollow1).rejects.toThrow('Could not locate record:')

    const getFollow2 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: bob.did,
      collection: 'app.bsky.graph.follow',
      rkey: new AtUri(follow2.uri).rkey,
    })

    await expect(getFollow2).resolves.toBeDefined()

    const getFollow3 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: 'app.bsky.graph.follow',
      rkey: new AtUri(follow3.uri).rkey,
    })

    await expect(getFollow3).resolves.toBeDefined()
  })

  // Moderation
  // --------------

  it("doesn't serve taken-down record", async () => {
    const created = await aliceAgent.api.app.bsky.feed.post.create(
      { repo: alice.did },
      {
        $type: 'app.bsky.feed.post',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      },
    )
    const postUri = new AtUri(created.uri)
    const post = await agent.api.app.bsky.feed.post.get({
      repo: alice.did,
      rkey: postUri.rkey,
    })
    const posts = await agent.api.app.bsky.feed.post.list({ repo: alice.did })
    expect(posts.records.map((r) => r.uri)).toContain(post.uri)

    const { data: action } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: created.uri,
            cid: created.cid,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const postTakedownPromise = agent.api.app.bsky.feed.post.get({
      repo: alice.did,
      rkey: postUri.rkey,
    })
    await expect(postTakedownPromise).rejects.toThrow('Could not locate record')
    const postsTakedown = await agent.api.app.bsky.feed.post.list({
      repo: alice.did,
    })
    expect(postsTakedown.records.map((r) => r.uri)).not.toContain(post.uri)

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: action.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })

  it("doesn't serve taken-down actor", async () => {
    const posts = await agent.api.app.bsky.feed.post.list({ repo: alice.did })
    expect(posts.records.length).toBeGreaterThan(0)

    const { data: action } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: alice.did,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const tryListPosts = agent.api.app.bsky.feed.post.list({
      repo: alice.did,
    })
    await expect(tryListPosts).rejects.toThrow(/Could not find repo/)

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: action.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })
})

function createDeepObject(depth: number) {
  const obj: any = {}
  let iter = obj
  for (let i = 0; i < depth; ++i) {
    iter.x = {}
    iter = iter.x
  }
  return obj
}

function typedArrayToBuffer(array: Uint8Array): ArrayBuffer {
  return array.buffer.slice(
    array.byteOffset,
    array.byteLength + array.byteOffset,
  )
}
