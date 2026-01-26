import assert from 'node:assert'
import fs from 'node:fs/promises'
import { AppBskyFeedPostRecord, AtpAgent } from '@atproto/api'
import { TID, cidForCbor, ui8ToArrayBuffer } from '@atproto/common'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { BlobRef } from '@atproto/lexicon'
import { BlobNotFoundError } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { AppContext } from '../src/context'
import { ids, lexicons } from '../src/lexicon/lexicons'
import { isMain as isImagesEmbed } from '../src/lexicon/types/app/bsky/embed/images'
import * as Post from '../src/lexicon/types/app/bsky/feed/post'
import { forSnapshot, paginateAll } from './_util'

describe('crud operations', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent
  let aliceAgent: AtpAgent
  let bobAgent: AtpAgent

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'crud',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    agent = network.pds.getClient()
    aliceAgent = network.pds.getClient()
    bobAgent = network.pds.getClient()

    await aliceAgent.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })

    await bobAgent.createAccount({
      email: 'bob@test.com',
      handle: 'bob.test',
      password: 'bob-pass',
    })

    expect(bobAgent.accountDid).not.toBe(aliceAgent.accountDid)
  })

  afterAll(async () => {
    await network.close()
  })

  it('registers users', async () => {
    const res = await agent.api.com.atproto.server.createAccount({
      handle: 'user1.test',
      email: 'user1@test.com',
      password: 'password',
    })
    expect(res.data.handle).toBe('user1.test')
    expect(res.data.accessJwt).toBeDefined()
  })

  it('describes repo', async () => {
    const description = await agent.api.com.atproto.repo.describeRepo({
      repo: aliceAgent.accountDid,
    })
    expect(description.data.handle).toBe('alice.test')
    expect(description.data.did).toBe(aliceAgent.accountDid)
    const description2 = await agent.api.com.atproto.repo.describeRepo({
      repo: bobAgent.accountDid,
    })
    expect(description2.data.handle).toBe('bob.test')
    expect(description2.data.did).toBe(bobAgent.accountDid)
  })

  it('creates records', async () => {
    const res = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      },
    })
    const uri = new AtUri(res.data.uri)
    expect(res.data.uri).toBe(
      `at://${aliceAgent.accountDid}/app.bsky.feed.post/${uri.rkey}`,
    )

    const res1 = await agent.api.com.atproto.repo.listRecords({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.post',
    })
    expect(res1.data.records.length).toBe(1)
    expect(res1.data.records[0].uri).toBe(uri.toString())
    expect((res1.data.records[0].value as Post.Record).text).toBe(
      'Hello, world!',
    )

    const res2 = await agent.app.bsky.feed.post.list({
      repo: aliceAgent.accountDid,
    })
    expect(res2.records.length).toBe(1)
    expect(res2.records[0].uri).toBe(uri.toString())
    expect(res2.records[0].value.text).toBe('Hello, world!')

    const res3 = await agent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.post',
      rkey: uri.rkey,
    })
    expect(res3.data.uri).toBe(uri.toString())
    expect((res3.data.value as Post.Record).text).toBe('Hello, world!')

    const res4 = await agent.app.bsky.feed.post.get({
      repo: aliceAgent.accountDid,
      rkey: uri.rkey,
    })
    expect(res4.uri).toBe(uri.toString())
    expect(res4.value.text).toBe('Hello, world!')

    await aliceAgent.api.com.atproto.repo.deleteRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.post',
      rkey: uri.rkey,
    })
    const res5 = await agent.api.com.atproto.repo.listRecords({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.post',
    })
    expect(res5.data.records.length).toBe(0)
  })

  it('CRUDs records with the semantic sugars', async () => {
    const res1 = await aliceAgent.app.bsky.feed.post.create(
      { repo: aliceAgent.accountDid },
      {
        $type: 'app.bsky.feed.post',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      },
    )
    const uri = new AtUri(res1.uri)

    const res2 = await agent.app.bsky.feed.post.list({
      repo: aliceAgent.accountDid,
    })
    expect(res2.records.length).toBe(1)

    await aliceAgent.app.bsky.feed.post.delete({
      repo: aliceAgent.accountDid,
      rkey: uri.rkey,
    })

    const res3 = await agent.app.bsky.feed.post.list({
      repo: aliceAgent.accountDid,
    })
    expect(res3.records.length).toBe(0)
  })

  it('attaches images to a post', async () => {
    const file = await fs.readFile('../dev-env/assets/key-landscape-small.jpg')
    const uploadedRes = await aliceAgent.api.com.atproto.repo.uploadBlob(file, {
      encoding: 'image/jpeg',
    })
    const uploaded = uploadedRes.data.blob
    // Expect blobstore not to have image yet
    await expect(
      ctx.blobstore(aliceAgent.accountDid).getBytes(uploaded.ref),
    ).rejects.toThrow(BlobNotFoundError)
    // Associate image with post, image should be placed in blobstore
    const res = await aliceAgent.app.bsky.feed.post.create(
      { repo: aliceAgent.accountDid },
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
    const post = await aliceAgent.app.bsky.feed.post.get({
      rkey: postUri.rkey,
      repo: aliceAgent.accountDid,
    })
    assert(isImagesEmbed(post.value.embed))
    const images = post.value.embed.images
    expect(images.length).toEqual(1)
    expect(uploaded.ref.equals(images[0].image.ref)).toBeTruthy()
    // Ensure that the uploaded image is now in the blobstore, i.e. doesn't throw BlobNotFoundError
    await ctx.blobstore(aliceAgent.accountDid).getBytes(uploaded.ref)
    // Cleanup
    await aliceAgent.app.bsky.feed.post.delete({
      rkey: postUri.rkey,
      repo: aliceAgent.accountDid,
    })
  })

  it('creates records with the correct key described by the schema', async () => {
    const res1 = await aliceAgent.app.bsky.actor.profile.create(
      { repo: aliceAgent.accountDid },
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
        const res = await aliceAgent.app.bsky.feed.post.create(
          { repo: aliceAgent.accountDid },
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
        await aliceAgent.app.bsky.feed.post.delete({
          repo: aliceAgent.accountDid,
          rkey: uri.rkey,
        })
      }
    })

    it('in forwards order', async () => {
      const results = (
        results: Awaited<ReturnType<AppBskyFeedPostRecord['list']>>[],
      ) => results.flatMap((res) => res.records)
      const paginator = async (cursor?: string) => {
        const res = await agent.app.bsky.feed.post.list({
          repo: aliceAgent.accountDid,
          cursor,
          limit: 2,
        })
        return res
      }

      const paginatedAll = await paginateAll(paginator)
      paginatedAll.forEach((res) =>
        expect(res.records.length).toBeLessThanOrEqual(2),
      )

      const full = await agent.app.bsky.feed.post.list({
        repo: aliceAgent.accountDid,
      })

      expect(full.records.length).toEqual(5)
      expect(results(paginatedAll)).toEqual(results([full]))
    })

    it('in reverse order', async () => {
      const results = (
        results: Awaited<ReturnType<AppBskyFeedPostRecord['list']>>[],
      ) => results.flatMap((res) => res.records)
      const paginator = async (cursor?: string) => {
        const res = await agent.app.bsky.feed.post.list({
          repo: aliceAgent.accountDid,
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

      const full = await agent.app.bsky.feed.post.list({
        repo: aliceAgent.accountDid,
        reverse: true,
      })

      expect(full.records.length).toEqual(5)
      expect(results(paginatedAll)).toEqual(results([full]))
    })

    it('reverses', async () => {
      const forwards = await agent.app.bsky.feed.post.list({
        repo: aliceAgent.accountDid,
      })
      const reverse = await agent.app.bsky.feed.post.list({
        repo: aliceAgent.accountDid,
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
        repo: aliceAgent.accountDid,
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
        repo: aliceAgent.accountDid,
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

    it('does not delete the underlying block if it is referenced elsewhere', async () => {
      const { repo } = aliceAgent.api.com.atproto
      const record = { text: 'post', createdAt: new Date().toISOString() }
      const { data: post1 } = await repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyFeedPost,
        record,
      })
      const { data: post2 } = await repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyFeedPost,
        record,
      })
      const uri1 = new AtUri(post1.uri)
      await repo.deleteRecord({
        repo: uri1.host,
        collection: uri1.collection,
        rkey: uri1.rkey,
      })
      const uri2 = new AtUri(post2.uri)
      const checkPost2 = await repo.getRecord({
        repo: uri2.host,
        collection: uri2.collection,
        rkey: uri2.rkey,
      })
      expect(checkPost2).toBeDefined()
      expect(checkPost2.data.value).toMatchObject(record)
    })
  })

  describe('putRecord', () => {
    const profilePath = {
      collection: ids.AppBskyActorProfile,
      rkey: 'self',
    }

    it("creates a new record if it doesn't already exist", async () => {
      const { repo } = bobAgent.api.com.atproto
      const exists = repo.getRecord({
        ...profilePath,
        repo: bobAgent.accountDid,
      })
      await expect(exists).rejects.toThrow('Could not locate record')

      const { data: put } = await repo.putRecord({
        ...profilePath,
        repo: bobAgent.accountDid,
        record: {
          displayName: 'Robert',
        },
      })
      expect(put.uri).toEqual(
        `at://${bobAgent.accountDid}/${ids.AppBskyActorProfile}/self`,
      )

      const { data: profile } = await repo.getRecord({
        ...profilePath,
        repo: bobAgent.accountDid,
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
        repo: bobAgent.accountDid,
        record: {
          displayName: 'Robert',
          description: 'Dog lover',
        },
      })
      expect(put.uri).toEqual(
        `at://${bobAgent.accountDid}/${ids.AppBskyActorProfile}/self`,
      )

      const { data: profile } = await repo.getRecord({
        ...profilePath,
        repo: bobAgent.accountDid,
      })
      expect(profile.value).toEqual({
        $type: ids.AppBskyActorProfile,
        displayName: 'Robert',
        description: 'Dog lover',
      })
    })

    it('still works if repo is specified by handle', async () => {
      await bobAgent.api.com.atproto.repo.putRecord({
        repo: 'bob.test',
        collection: ids.AppBskyGraphFollow,
        rkey: TID.nextStr(),
        record: {
          subject: aliceAgent.accountDid,
          createdAt: new Date().toISOString(),
        },
      })
    })

    it('does not produce commit on no-op update', async () => {
      const { repo } = bobAgent.api.com.atproto
      const rootRes1 = await bobAgent.api.com.atproto.sync.getLatestCommit({
        did: bobAgent.accountDid,
      })
      const { data: put } = await repo.putRecord({
        ...profilePath,
        repo: bobAgent.accountDid,
        record: {
          displayName: 'Robert',
          description: 'Dog lover',
        },
      })
      expect(put.uri).toEqual(
        `at://${bobAgent.accountDid}/${ids.AppBskyActorProfile}/self`,
      )

      const rootRes2 = await bobAgent.api.com.atproto.sync.getLatestCommit({
        did: bobAgent.accountDid,
      })

      expect(rootRes2.data.cid).toEqual(rootRes1.data.cid)
      expect(rootRes2.data.rev).toEqual(rootRes1.data.rev)
    })

    it('fails on user mismatch', async () => {
      const { repo } = aliceAgent.api.com.atproto
      const put = repo.putRecord({
        repo: bobAgent.accountDid,
        collection: ids.AppBskyGraphFollow,
        rkey: TID.nextStr(),
        record: {
          subject: aliceAgent.accountDid,
          createdAt: new Date().toISOString(),
        },
      })
      await expect(put).rejects.toThrow('Authentication Required')
    })

    it('fails on invalid record', async () => {
      const { repo } = bobAgent.api.com.atproto
      const put = repo.putRecord({
        ...profilePath,
        repo: bobAgent.accountDid,
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
        repo: bobAgent.accountDid,
      })
      expect(profile.value).toEqual({
        $type: ids.AppBskyActorProfile,
        displayName: 'Robert',
        description: 'Dog lover',
      })
    })

    // @TODO remove after migrating legacy blobs
    it('updates a legacy blob ref when updating profile', async () => {
      const { repo } = bobAgent.api.com.atproto
      const file = await fs.readFile('../dev-env/assets/key-portrait-small.jpg')
      const uploadedRes = await repo.uploadBlob(file, {
        encoding: 'image/jpeg',
      })

      await repo.putRecord({
        ...profilePath,
        repo: bobAgent.accountDid,
        record: {
          displayName: 'Robert',
          avatar: BlobRef.fromJsonRef({
            mimeType: uploadedRes.data.blob.mimeType,
            cid: uploadedRes.data.blob.ref.toString(),
          }),
        },
      })

      const got = await repo.getRecord({
        ...profilePath,
        repo: bobAgent.accountDid,
      })
      const gotAvatar = got.data.value['avatar'] as BlobRef
      expect(gotAvatar.original).toEqual(uploadedRes.data.blob.original)
    })
  })

  // Validation
  // --------------

  it('defaults an undefined $type on records', async () => {
    const res = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'blah',
        createdAt: new Date().toISOString(),
      },
    })
    const uri = new AtUri(res.data.uri)
    const got = await agent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: uri.collection,
      rkey: uri.rkey,
    })
    expect(got.data.value['$type']).toBe(uri.collection)
  })

  it('requires the schema to be known if explicitly validating', async () => {
    const prom = aliceAgent.api.com.atproto.repo.createRecord({
      validate: true,
      repo: aliceAgent.accountDid,
      collection: 'com.example.foobar',
      record: { $type: 'com.example.foobar' },
    })
    await expect(prom).rejects.toThrow(
      'Lexicon not found: lex:com.example.foobar',
    )
  })

  it('does not require the schema to be known if not explicitly validating', async () => {
    const prom = await aliceAgent.api.com.atproto.repo.createRecord({
      // validate not set
      repo: aliceAgent.accountDid,
      collection: 'com.example.foobar',
      record: { $type: 'com.example.foobar' },
    })
    expect(prom.data.validationStatus).toBe('unknown')
  })

  it('requires the $type to match the schema', async () => {
    await expect(
      aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.like' },
      }),
    ).rejects.toThrow(
      'Invalid $type: expected app.bsky.feed.post, got app.bsky.feed.like',
    )
  })

  it('requires valid rkey', async () => {
    await expect(
      aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.feed.generator',
        record: {
          $type: 'app.bsky.feed.generator',
          did: 'did:web:dummy.example.com',
          displayName: 'dummy',
          createdAt: new Date().toISOString(),
        },
        rkey: '..',
      }),
    ).rejects.toThrow('Input/rkey must be a valid Record Key')
  })

  it('validates the record on write', async () => {
    await expect(
      aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.post' },
      }),
    ).rejects.toThrow(
      'Invalid app.bsky.feed.post record: Record must have the property "text"',
    )
  })

  it('validates datetimes more rigorously than lex sdk', async () => {
    const postRecord = {
      $type: 'app.bsky.feed.post',
      text: 'test',
      createdAt: '1985-04-12T23:20:50.123',
    }
    lexicons.assertValidRecord('app.bsky.feed.post', postRecord)
    await expect(
      aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.feed.post',
        record: postRecord,
      }),
    ).rejects.toThrow(
      'Invalid app.bsky.feed.post record: createdAt must be an valid atproto datetime (both RFC-3339 and ISO-8601)',
    )
  })

  describe('unvalidated writes', () => {
    it('disallows creation of unknown lexicons when validate is set to true', async () => {
      const attempt = aliceAgent.api.com.atproto.repo.createRecord({
        validate: true,
        repo: aliceAgent.accountDid,
        collection: 'com.example.record',
        record: {
          blah: 'thing',
        },
      })
      await expect(attempt).rejects.toThrow(
        'Lexicon not found: lex:com.example.record',
      )
    })

    it('allows creation of unknown lexicons when validate is not set to true', async () => {
      // validate: default
      const res1 = await aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'com.example.record',
        record: {
          blah: 'thing1',
        },
      })
      expect(res1.data.validationStatus).toBe('unknown')
      const record1 = await ctx.actorStore.read(
        aliceAgent.accountDid,
        (store) =>
          store.record.getRecord(new AtUri(res1.data.uri), res1.data.cid),
      )
      expect(record1?.value).toEqual({
        $type: 'com.example.record',
        blah: 'thing1',
      })
      // validate: false
      const res2 = await aliceAgent.api.com.atproto.repo.createRecord({
        validate: false,
        repo: aliceAgent.accountDid,
        collection: 'com.example.record',
        record: {
          blah: 'thing2',
        },
      })
      expect(res2.data.validationStatus).toBeUndefined()
      const record2 = await ctx.actorStore.read(
        aliceAgent.accountDid,
        (store) =>
          store.record.getRecord(new AtUri(res2.data.uri), res2.data.cid),
      )
      expect(record2?.value).toEqual({
        $type: 'com.example.record',
        blah: 'thing2',
      })
    })

    it('allows update of unknown lexicons when validate is set to false', async () => {
      const createRes = await aliceAgent.api.com.atproto.repo.createRecord({
        validate: false,
        repo: aliceAgent.accountDid,
        collection: 'com.example.record',
        record: {
          blah: 'thing',
        },
      })
      const uri = new AtUri(createRes.data.uri)
      // validate: default
      const updateRes1 = await aliceAgent.api.com.atproto.repo.putRecord({
        repo: aliceAgent.accountDid,
        collection: 'com.example.record',
        rkey: uri.rkey,
        record: {
          blah: 'something else',
        },
      })
      const record1 = await ctx.actorStore.read(
        aliceAgent.accountDid,
        (store) => store.record.getRecord(uri, updateRes1.data.cid),
      )
      expect(record1?.value).toEqual({
        $type: 'com.example.record',
        blah: 'something else',
      })
      // validate: false
      const updateRes2 = await aliceAgent.api.com.atproto.repo.putRecord({
        validate: false,
        repo: aliceAgent.accountDid,
        collection: 'com.example.record',
        rkey: uri.rkey,
        record: {
          blah: 'something else',
        },
      })
      const record2 = await ctx.actorStore.read(
        aliceAgent.accountDid,
        (store) => store.record.getRecord(uri, updateRes2.data.cid),
      )
      expect(record2?.value).toEqual({
        $type: 'com.example.record',
        blah: 'something else',
      })
    })

    it('applyWrites returns results with validation status', async () => {
      const existing1 = await aliceAgent.api.com.atproto.repo.createRecord({
        validate: false,
        repo: aliceAgent.accountDid,
        collection: 'com.example.record',
        record: {
          blah: 'thing1',
        },
      })
      const existing2 = await aliceAgent.api.com.atproto.repo.createRecord({
        validate: false,
        repo: aliceAgent.accountDid,
        collection: 'com.example.record',
        record: {
          blah: 'thing2',
        },
      })
      const {
        data: { results },
      } = await aliceAgent.com.atproto.repo.applyWrites({
        repo: aliceAgent.accountDid,
        writes: [
          {
            $type: `${ids.ComAtprotoRepoApplyWrites}#create`,
            collection: ids.AppBskyFeedPost,
            value: {
              $type: ids.AppBskyFeedPost,
              text: '👋',
              createdAt: new Date().toISOString(),
            },
          },
          {
            $type: `${ids.ComAtprotoRepoApplyWrites}#update`,
            collection: 'com.example.record',
            rkey: new AtUri(existing1.data.uri).rkey,
            value: {},
          },
          {
            $type: `${ids.ComAtprotoRepoApplyWrites}#delete`,
            collection: 'com.example.record',
            rkey: new AtUri(existing2.data.uri).rkey,
          },
        ],
      })
      expect(forSnapshot(results)).toEqual([
        {
          $type: `${ids.ComAtprotoRepoApplyWrites}#createResult`,
          cid: 'cids(0)',
          uri: 'record(0)',
          validationStatus: 'valid',
        },
        {
          $type: `${ids.ComAtprotoRepoApplyWrites}#updateResult`,
          cid: 'cids(1)',
          uri: 'record(1)',
          validationStatus: 'unknown',
        },
        { $type: `${ids.ComAtprotoRepoApplyWrites}#deleteResult` },
      ])
    })

    it('correctly associates images with unknown record types', async () => {
      const file = await fs.readFile('../dev-env/assets/key-portrait-small.jpg')
      const uploadedRes = await aliceAgent.api.com.atproto.repo.uploadBlob(
        file,
        {
          encoding: 'image/jpeg',
        },
      )

      const res = await aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'com.example.record',
        record: {
          blah: 'thing',
          image: uploadedRes.data.blob,
        },
        validate: false,
      })
      const record = await ctx.actorStore.read(aliceAgent.accountDid, (store) =>
        store.record.getRecord(new AtUri(res.data.uri), res.data.cid),
      )
      assert(record)
      expect(record.value).toMatchObject({
        $type: 'com.example.record',
        blah: 'thing',
      })
      const recordBlobs = await ctx.actorStore.read(
        aliceAgent.assertDid,
        (store) => store.repo.blob.getBlobsForRecord(record.uri),
      )
      expect(recordBlobs.length).toBe(1)
      expect(recordBlobs.at(0)).toBe(uploadedRes.data.blob.ref.toString())
    })

    it('enforces record type constraint even when unvalidated', async () => {
      const attempt = aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'com.example.record',
        record: {
          $type: 'com.example.other',
          blah: 'thing',
        },
      })
      await expect(attempt).rejects.toThrow(
        'Invalid $type: expected com.example.record, got com.example.other',
      )
    })

    it('enforces blob ref format even when unvalidated', async () => {
      const file = await fs.readFile('../dev-env/assets/key-portrait-small.jpg')
      const uploadedRes = await aliceAgent.api.com.atproto.repo.uploadBlob(
        file,
        {
          encoding: 'image/jpeg',
        },
      )

      const attempt = aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'com.example.record',
        record: {
          blah: 'thing',
          image: {
            cid: uploadedRes.data.blob.ref.toString(),
            mimeType: uploadedRes.data.blob.mimeType,
          },
        },
        validate: false,
      })
      await expect(attempt).rejects.toThrow(`Legacy blob ref at 'image'`)
    })
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
      const { data: commit } = await sync.getLatestCommit({
        did: aliceAgent.accountDid,
      })
      const { data: post } = await repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyFeedPost,
        swapCommit: commit.cid,
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
      const { data: staleCommit } = await sync.getLatestCommit({
        did: aliceAgent.accountDid,
      })
      // Update repo, change head
      await repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const attemptCreate = repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyFeedPost,
        swapCommit: staleCommit.cid,
        record: postRecord(),
      })
      await expect(attemptCreate).rejects.toMatchObject({
        error: 'InvalidSwap',
      })
    })

    it('deleteRecord succeeds on proper commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: post } = await repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const { data: commit } = await sync.getLatestCommit({
        did: aliceAgent.accountDid,
      })
      const uri = new AtUri(post.uri)
      await repo.deleteRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
        swapCommit: commit.cid,
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
      const { data: staleCommit } = await sync.getLatestCommit({
        did: aliceAgent.accountDid,
      })
      const { data: post } = await repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const uri = new AtUri(post.uri)
      const attemptDelete = repo.deleteRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
        swapCommit: staleCommit.cid,
      })
      await expect(attemptDelete).rejects.toMatchObject({
        error: 'InvalidSwap',
      })
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
        repo: aliceAgent.accountDid,
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
        repo: aliceAgent.accountDid,
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
      await expect(attemptDelete).rejects.toMatchObject({
        error: 'InvalidSwap',
      })
      const checkPost = repo.getRecord({
        repo: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      await expect(checkPost).resolves.toBeDefined()
    })

    it('putRecord succeeds on proper commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: commit } = await sync.getLatestCommit({
        did: aliceAgent.accountDid,
      })
      const { data: profile } = await repo.putRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapCommit: commit.cid,
        record: profileRecord(),
      })
      const { data: checkProfile } = await repo.getRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
      })
      expect(checkProfile.cid).toEqual(profile.cid)
    })

    it('putRecord fails on bad commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: staleCommit } = await sync.getLatestCommit({
        did: aliceAgent.accountDid,
      })
      // Update repo, change head
      await repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const attemptPut = repo.putRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapCommit: staleCommit.cid,
        record: profileRecord(),
      })
      await expect(attemptPut).rejects.toMatchObject({ error: 'InvalidSwap' })
    })

    it('putRecord succeeds on proper record cas', async () => {
      const { repo } = aliceAgent.api.com.atproto
      // Start with missing profile record, to test swapRecord=null
      await repo.deleteRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
      })
      // Test swapRecord w/ null (ensures create)
      const { data: profile1 } = await repo.putRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapRecord: null,
        record: profileRecord(),
      })
      const { data: checkProfile1 } = await repo.getRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
      })
      expect(checkProfile1.cid).toEqual(profile1.cid)
      // Test swapRecord w/ cid (ensures update)
      const { data: profile2 } = await repo.putRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapRecord: profile1.cid,
        record: profileRecord(),
      })
      const { data: checkProfile2 } = await repo.getRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
      })
      expect(checkProfile2.cid).toEqual(profile2.cid)
    })

    it('putRecord fails on bad record cas', async () => {
      const { repo } = aliceAgent.api.com.atproto
      // Test swapRecord w/ null (ensures create)
      const attemptPut1 = repo.putRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapRecord: null,
        record: profileRecord(),
      })
      await expect(attemptPut1).rejects.toMatchObject({ error: 'InvalidSwap' })
      // Test swapRecord w/ cid (ensures update)
      const attemptPut2 = repo.putRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        swapRecord: (await cidForCbor({})).toString(),
        record: profileRecord(),
      })
      await expect(attemptPut2).rejects.toMatchObject({ error: 'InvalidSwap' })
    })

    it('applyWrites succeeds on proper commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: commit } = await sync.getLatestCommit({
        did: aliceAgent.accountDid,
      })
      await repo.applyWrites({
        repo: aliceAgent.accountDid,
        swapCommit: commit.cid,
        writes: [
          {
            $type: `${ids.ComAtprotoRepoApplyWrites}#create`,
            collection: ids.AppBskyFeedPost,
            value: { $type: ids.AppBskyFeedPost, ...postRecord() },
          },
        ],
      })
    })

    it('applyWrites fails on bad commit cas', async () => {
      const { repo, sync } = aliceAgent.api.com.atproto
      const { data: staleCommit } = await sync.getLatestCommit({
        did: aliceAgent.accountDid,
      })
      // Update repo, change head
      await repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: ids.AppBskyFeedPost,
        record: postRecord(),
      })
      const attemptApplyWrite = repo.applyWrites({
        repo: aliceAgent.accountDid,
        swapCommit: staleCommit.cid,
        writes: [
          {
            $type: `${ids.ComAtprotoRepoApplyWrites}#create`,
            collection: ids.AppBskyFeedPost,
            value: { $type: ids.AppBskyFeedPost, ...postRecord() },
          },
        ],
      })
      await expect(attemptApplyWrite).rejects.toMatchObject({
        error: 'InvalidSwap',
      })
    })

    it("writes fail on values that can't reliably transform between cbor to lex", async () => {
      const passthroughBody = (data: unknown) =>
        ui8ToArrayBuffer(new TextEncoder().encode(JSON.stringify(data)))

      const result = aliceAgent.call(
        'com.atproto.repo.createRecord',
        {},
        passthroughBody({
          repo: aliceAgent.accountDid,
          collection: 'app.bsky.feed.post',
          record: {
            text: 'x',
            createdAt: new Date().toISOString(),
            deepObject: createDeepObject(4000),
          },
        }),
        {
          encoding: 'application/json',
        },
      )

      await expect(result).rejects.toMatchObject({
        status: 400,
        error: 'InvalidRequest',
      })
    })
  })

  it('prevents duplicate likes', async () => {
    const now = new Date().toISOString()
    const uriA = AtUri.make(
      bobAgent.accountDid,
      'app.bsky.feed.post',
      TID.nextStr(),
    )
    const cidA = await cidForCbor({ post: 'a' })
    const uriB = AtUri.make(
      bobAgent.accountDid,
      'app.bsky.feed.post',
      TID.nextStr(),
    )
    const cidB = await cidForCbor({ post: 'b' })

    const { data: like1 } = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.like',
      record: {
        $type: 'app.bsky.feed.like',
        subject: { uri: uriA.toString(), cid: cidA.toString() },
        createdAt: now,
      },
    })
    const { data: like2 } = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.like',
      record: {
        $type: 'app.bsky.feed.like',
        subject: { uri: uriB.toString(), cid: cidB.toString() },
        createdAt: now,
      },
    })
    const { data: like3 } = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.like',
      record: {
        $type: 'app.bsky.feed.like',
        subject: { uri: uriA.toString(), cid: cidA.toString() },
        createdAt: now,
      },
    })

    const getLike1 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.like',
      rkey: new AtUri(like1.uri).rkey,
    })

    await expect(getLike1).rejects.toThrow('Could not locate record:')

    const getLike2 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.like',
      rkey: new AtUri(like2.uri).rkey,
    })

    await expect(getLike2).resolves.toBeDefined()

    const getLike3 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.like',
      rkey: new AtUri(like3.uri).rkey,
    })

    await expect(getLike3).resolves.toBeDefined()
  })

  it('prevents duplicate reposts', async () => {
    const now = new Date().toISOString()
    const uriA = AtUri.make(
      bobAgent.accountDid,
      'app.bsky.feed.post',
      TID.nextStr(),
    )
    const cidA = await cidForCbor({ post: 'a' })
    const uriB = AtUri.make(
      bobAgent.accountDid,
      'app.bsky.feed.post',
      TID.nextStr(),
    )
    const cidB = await cidForCbor({ post: 'b' })

    const { data: repost1 } =
      await aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.feed.repost',
        record: {
          $type: 'app.bsky.feed.repost',
          subject: { uri: uriA.toString(), cid: cidA.toString() },
          createdAt: now,
        },
      })
    const { data: repost2 } =
      await aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.feed.repost',
        record: {
          $type: 'app.bsky.feed.repost',
          subject: { uri: uriB.toString(), cid: cidB.toString() },
          createdAt: now,
        },
      })
    const { data: repost3 } =
      await aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.feed.repost',
        record: {
          $type: 'app.bsky.feed.repost',
          subject: { uri: uriA.toString(), cid: cidA.toString() },
          createdAt: now,
        },
      })

    const getRepost1 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.repost',
      rkey: new AtUri(repost1.uri).rkey,
    })

    await expect(getRepost1).rejects.toThrow('Could not locate record:')

    const getRepost2 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.repost',
      rkey: new AtUri(repost2.uri).rkey,
    })

    await expect(getRepost2).resolves.toBeDefined()

    const getRepost3 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.feed.repost',
      rkey: new AtUri(repost3.uri).rkey,
    })

    await expect(getRepost3).resolves.toBeDefined()
  })

  it('prevents duplicate blocks', async () => {
    const now = new Date().toISOString()

    const { data: block1 } = await aliceAgent.api.com.atproto.repo.createRecord(
      {
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.graph.block',
        record: {
          $type: 'app.bsky.graph.block',
          subject: bobAgent.accountDid,
          createdAt: now,
        },
      },
    )

    const { data: block2 } = await bobAgent.api.com.atproto.repo.createRecord({
      repo: bobAgent.accountDid,
      collection: 'app.bsky.graph.block',
      record: {
        $type: 'app.bsky.graph.block',
        subject: aliceAgent.accountDid,
        createdAt: now,
      },
    })

    const { data: block3 } = await aliceAgent.api.com.atproto.repo.createRecord(
      {
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.graph.block',
        record: {
          $type: 'app.bsky.graph.block',
          subject: bobAgent.accountDid,
          createdAt: now,
        },
      },
    )

    const getBlock1 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.block',
      rkey: new AtUri(block1.uri).rkey,
    })

    await expect(getBlock1).rejects.toThrow('Could not locate record:')

    const getBlock2 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: bobAgent.accountDid,
      collection: 'app.bsky.graph.block',
      rkey: new AtUri(block2.uri).rkey,
    })

    await expect(getBlock2).resolves.toBeDefined()

    const getBlock3 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.block',
      rkey: new AtUri(block3.uri).rkey,
    })

    await expect(getBlock3).resolves.toBeDefined()
  })

  it('prevents duplicate follows', async () => {
    const now = new Date().toISOString()

    const { data: follow1 } =
      await aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.graph.follow',
        record: {
          $type: 'app.bsky.graph.follow',
          subject: bobAgent.accountDid,
          createdAt: now,
        },
      })
    const { data: follow2 } = await bobAgent.api.com.atproto.repo.createRecord({
      repo: bobAgent.accountDid,
      collection: 'app.bsky.graph.follow',
      record: {
        $type: 'app.bsky.graph.follow',
        subject: aliceAgent.accountDid,
        createdAt: now,
      },
    })
    const { data: follow3 } =
      await aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.graph.follow',
        record: {
          $type: 'app.bsky.graph.follow',
          subject: bobAgent.accountDid,
          createdAt: now,
        },
      })

    const getFollow1 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.follow',
      rkey: new AtUri(follow1.uri).rkey,
    })

    await expect(getFollow1).rejects.toThrow('Could not locate record:')

    const getFollow2 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: bobAgent.accountDid,
      collection: 'app.bsky.graph.follow',
      rkey: new AtUri(follow2.uri).rkey,
    })

    await expect(getFollow2).resolves.toBeDefined()

    const getFollow3 = aliceAgent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.follow',
      rkey: new AtUri(follow3.uri).rkey,
    })

    await expect(getFollow3).resolves.toBeDefined()
  })

  // Moderation
  // --------------

  it("doesn't serve taken-down record", async () => {
    const created = await aliceAgent.app.bsky.feed.post.create(
      { repo: aliceAgent.accountDid },
      {
        $type: 'app.bsky.feed.post',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      },
    )
    const postUri = new AtUri(created.uri)
    const post = await agent.app.bsky.feed.post.get({
      repo: aliceAgent.accountDid,
      rkey: postUri.rkey,
    })
    const posts = await agent.app.bsky.feed.post.list({
      repo: aliceAgent.accountDid,
    })
    expect(posts.records.map((r) => r.uri)).toContain(post.uri)

    const subject = {
      $type: 'com.atproto.repo.strongRef',
      uri: created.uri,
      cid: created.cid,
    }
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject,
        takedown: { applied: true },
      },
      {
        encoding: 'application/json',
        headers: { authorization: network.pds.adminAuth() },
      },
    )

    const postTakedownPromise = agent.app.bsky.feed.post.get({
      repo: aliceAgent.accountDid,
      rkey: postUri.rkey,
    })
    await expect(postTakedownPromise).rejects.toThrow('Could not locate record')
    const postsTakedown = await agent.app.bsky.feed.post.list({
      repo: aliceAgent.accountDid,
    })
    expect(postsTakedown.records.map((r) => r.uri)).not.toContain(post.uri)

    // Cleanup
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject,
        takedown: { applied: false },
      },
      {
        encoding: 'application/json',
        headers: { authorization: network.pds.adminAuth() },
      },
    )
  })

  it("doesn't serve taken-down actor", async () => {
    const posts = await agent.app.bsky.feed.post.list({
      repo: aliceAgent.accountDid,
    })
    expect(posts.records.length).toBeGreaterThan(0)

    const subject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: aliceAgent.accountDid,
    }

    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject,
        takedown: { applied: true },
      },
      {
        encoding: 'application/json',
        headers: { authorization: network.pds.adminAuth() },
      },
    )

    const tryListPosts = agent.app.bsky.feed.post.list({
      repo: aliceAgent.accountDid,
    })
    await expect(tryListPosts).rejects.toThrow(/Could not find repo/)

    // Cleanup
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject,
        takedown: { applied: false },
      },
      {
        encoding: 'application/json',
        headers: { authorization: network.pds.adminAuth() },
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
