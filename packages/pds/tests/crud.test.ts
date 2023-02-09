import fs from 'fs/promises'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import AtpAgent from '@atproto/api'
import * as Post from '../src/lexicon/types/app/bsky/feed/post'
import { adminAuth, CloseFn, paginateAll, runTestServer } from './_util'
import { BlobNotFoundError } from '@atproto/repo'
import AppContext from '../src/context'
import { TAKEDOWN } from '../src/lexicon/types/com/atproto/admin/moderationAction'

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
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'crud',
    })
    ctx = server.ctx
    close = server.close
    agent = new AtpAgent({ service: server.url })
    aliceAgent = new AtpAgent({ service: server.url })
  })

  afterAll(async () => {
    await close()
  })

  it('registers users', async () => {
    const res = await agent.api.com.atproto.account.create({
      email: alice.email,
      handle: alice.handle,
      password: alice.password,
    })
    aliceAgent.api.setHeader('authorization', `Bearer ${res.data.accessJwt}`)
    alice.did = res.data.did
    const res2 = await agent.api.com.atproto.account.create({
      email: bob.email,
      handle: bob.handle,
      password: bob.password,
    })
    bob.did = res2.data.did
  })

  it('describes repo', async () => {
    const description = await agent.api.com.atproto.repo.describe({
      user: alice.did,
    })
    expect(description.data.handle).toBe(alice.handle)
    expect(description.data.did).toBe(alice.did)
    const description2 = await agent.api.com.atproto.repo.describe({
      user: bob.did,
    })
    expect(description2.data.handle).toBe(bob.handle)
    expect(description2.data.did).toBe(bob.did)
  })

  let uri: AtUri
  it('creates records', async () => {
    const res = await aliceAgent.api.com.atproto.repo.createRecord({
      did: alice.did,
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
      user: alice.did,
      collection: 'app.bsky.feed.post',
    })
    expect(res1.data.records.length).toBe(1)
    expect(res1.data.records[0].uri).toBe(uri.toString())
    expect((res1.data.records[0].value as Post.Record).text).toBe(
      'Hello, world!',
    )

    const res2 = await agent.api.app.bsky.feed.post.list({
      user: alice.did,
    })
    expect(res2.records.length).toBe(1)
    expect(res2.records[0].uri).toBe(uri.toString())
    expect(res2.records[0].value.text).toBe('Hello, world!')
  })

  it('gets records', async () => {
    const res1 = await agent.api.com.atproto.repo.getRecord({
      user: alice.did,
      collection: 'app.bsky.feed.post',
      rkey: uri.rkey,
    })
    expect(res1.data.uri).toBe(uri.toString())
    expect((res1.data.value as Post.Record).text).toBe('Hello, world!')

    const res2 = await agent.api.app.bsky.feed.post.get({
      user: alice.did,
      rkey: uri.rkey,
    })
    expect(res2.uri).toBe(uri.toString())
    expect(res2.value.text).toBe('Hello, world!')
  })

  it('deletes records', async () => {
    await aliceAgent.api.com.atproto.repo.deleteRecord({
      did: alice.did,
      collection: 'app.bsky.feed.post',
      rkey: uri.rkey,
    })
    const res1 = await agent.api.com.atproto.repo.listRecords({
      user: alice.did,
      collection: 'app.bsky.feed.post',
    })
    expect(res1.data.records.length).toBe(0)
  })

  it('CRUDs records with the semantic sugars', async () => {
    const res1 = await aliceAgent.api.app.bsky.feed.post.create(
      { did: alice.did },
      {
        $type: 'app.bsky.feed.post',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      },
    )
    const uri = new AtUri(res1.uri)

    const res2 = await agent.api.app.bsky.feed.post.list({
      user: alice.did,
    })
    expect(res2.records.length).toBe(1)

    await aliceAgent.api.app.bsky.feed.post.delete({
      did: alice.did,
      rkey: uri.rkey,
    })

    const res3 = await agent.api.app.bsky.feed.post.list({
      user: alice.did,
    })
    expect(res3.records.length).toBe(0)
  })

  it('attaches images to a post', async () => {
    const file = await fs.readFile(
      'tests/image/fixtures/key-landscape-small.jpg',
    )
    const { data: image } = await aliceAgent.api.com.atproto.blob.upload(file, {
      encoding: 'image/jpeg',
    })
    const imageCid = CID.parse(image.cid)
    // Expect blobstore not to have image yet
    await expect(ctx.blobstore.getBytes(imageCid)).rejects.toThrow(
      BlobNotFoundError,
    )
    // Associate image with post, image should be placed in blobstore
    const res = await aliceAgent.api.app.bsky.feed.post.create(
      { did: alice.did },
      {
        $type: 'app.bsky.feed.post',
        text: "Here's a key!",
        createdAt: new Date().toISOString(),
        embed: {
          $type: 'app.bsky.embed.images',
          images: [
            { image: { cid: image.cid, mimeType: 'image/jpeg' }, alt: '' },
          ],
        },
      },
    )
    // Ensure image is on post record
    const postUri = new AtUri(res.uri)
    const post = await aliceAgent.api.app.bsky.feed.post.get({
      rkey: postUri.rkey,
      user: alice.did,
    })
    const images = post.value.embed?.images as { image: { cid: string } }[]
    expect(images.length).toEqual(1)
    expect(images[0].image.cid).toEqual(image.cid)
    // Ensure that the uploaded image is now in the blobstore, i.e. doesn't throw BlobNotFoundError
    await ctx.blobstore.getBytes(imageCid)
    // Cleanup
    await aliceAgent.api.app.bsky.feed.post.delete({
      rkey: postUri.rkey,
      did: alice.did,
    })
  })

  it('creates records with the correct key described by the schema', async () => {
    const res1 = await aliceAgent.api.app.bsky.actor.profile.create(
      { did: alice.did },
      {
        displayName: 'alice',
        createdAt: new Date().toISOString(),
      },
    )
    const uri = new AtUri(res1.uri)
    expect(uri.rkey).toBe('self')
  })

  describe('crud races', () => {
    let uris: AtUri[]
    it('handles races on add', async () => {
      const COUNT = 100
      const postTexts: string[] = []
      for (let i = 0; i < COUNT; i++) {
        postTexts.push(`post-${i}`)
      }
      const responses = await Promise.all(
        postTexts.map((text) =>
          aliceAgent.api.app.bsky.feed.post.create(
            { did: alice.did },
            {
              text,
              createdAt: new Date().toISOString(),
            },
          ),
        ),
      )

      uris = responses.map((resp) => new AtUri(resp.uri))

      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        const got = await aliceAgent.api.com.atproto.repo.getRecord({
          user: alice.did,
          collection: uri.collection,
          rkey: uri.rkey,
        })
        // @ts-ignore
        expect(got.data.value.text).toEqual(`post-${i}`)
      }
    })

    it('handles races on del', async () => {
      await Promise.all(
        uris.map((uri) =>
          aliceAgent.api.app.bsky.feed.post.delete({
            did: alice.did,
            rkey: uri.rkey,
          }),
        ),
      )
      for (const uri of uris) {
        await expect(
          aliceAgent.api.com.atproto.repo.getRecord({
            user: alice.did,
            collection: uri.collection,
            rkey: uri.rkey,
          }),
        ).rejects.toThrow(Error)
      }
    })
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
          { did: alice.did },
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
      await Promise.all(
        [uri1, uri2, uri3, uri4, uri5].map((uri) =>
          aliceAgent.api.app.bsky.feed.post.delete({
            did: alice.did,
            rkey: uri.rkey,
          }),
        ),
      )
    })

    it('in forwards order', async () => {
      const results = (results) => results.flatMap((res) => res.records)
      const paginator = async (cursor?: string) => {
        const res = await agent.api.app.bsky.feed.post.list({
          user: alice.did,
          before: cursor,
          limit: 2,
        })
        return res
      }

      const paginatedAll = await paginateAll(paginator)
      paginatedAll.forEach((res) =>
        expect(res.records.length).toBeLessThanOrEqual(2),
      )

      const full = await agent.api.app.bsky.feed.post.list({
        user: alice.did,
      })

      expect(full.records.length).toEqual(5)
      expect(results(paginatedAll)).toEqual(results([full]))
    })

    it('in reverse order', async () => {
      const results = (results) => results.flatMap((res) => res.records)
      const paginator = async (cursor?: string) => {
        const res = await agent.api.app.bsky.feed.post.list({
          user: alice.did,
          reverse: true,
          after: cursor,
          limit: 2,
        })
        return res
      }

      const paginatedAll = await paginateAll(paginator)
      paginatedAll.forEach((res) =>
        expect(res.records.length).toBeLessThanOrEqual(2),
      )

      const full = await agent.api.app.bsky.feed.post.list({
        user: alice.did,
        reverse: true,
      })

      expect(full.records.length).toEqual(5)
      expect(results(paginatedAll)).toEqual(results([full]))
    })

    it('between two records', async () => {
      const list = await agent.api.app.bsky.feed.post.list({
        user: alice.did,
        after: uri1.rkey,
        before: uri5.rkey,
      })
      expect(list.records.length).toBe(3)
      expect(list.records[0].uri).toBe(uri4.toString())
      expect(list.records[1].uri).toBe(uri3.toString())
      expect(list.records[2].uri).toBe(uri2.toString())
    })

    it('reverses', async () => {
      const forwards = await agent.api.app.bsky.feed.post.list({
        user: alice.did,
      })
      const reverse = await agent.api.app.bsky.feed.post.list({
        user: alice.did,
        reverse: true,
      })
      expect(forwards.cursor).toEqual(uri1.rkey)
      expect(reverse.cursor).toEqual(uri5.rkey)
      expect(forwards.records.length).toEqual(5)
      expect(reverse.records.length).toEqual(5)
      expect(forwards.records.reverse()).toEqual(reverse.records)
    })
  })

  // Validation
  // --------------

  it('defaults an undefined $type on records', async () => {
    const res = await aliceAgent.api.com.atproto.repo.createRecord({
      did: alice.did,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'blah',
        createdAt: new Date().toISOString(),
      },
    })
    const uri = new AtUri(res.data.uri)
    const got = await agent.api.com.atproto.repo.getRecord({
      user: alice.did,
      collection: uri.collection,
      rkey: uri.rkey,
    })
    expect(got.data.value['$type']).toBe(uri.collection)
  })

  it('requires the schema to be known if validating', async () => {
    const prom = aliceAgent.api.com.atproto.repo.createRecord({
      did: alice.did,
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
        did: alice.did,
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.vote' },
      }),
    ).rejects.toThrow(
      'Invalid $type: expected app.bsky.feed.post, got app.bsky.feed.vote',
    )
  })

  it('validates the record on write', async () => {
    await expect(
      aliceAgent.api.com.atproto.repo.createRecord({
        did: alice.did,
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.post' },
      }),
    ).rejects.toThrow(
      'Invalid app.bsky.feed.post record: Record must have the property "text"',
    )
  })

  // Moderation
  // --------------

  it("doesn't serve taken-down record", async () => {
    const created = await aliceAgent.api.app.bsky.feed.post.create(
      { did: alice.did },
      {
        $type: 'app.bsky.feed.post',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      },
    )
    const postUri = new AtUri(created.uri)
    const post = await agent.api.app.bsky.feed.post.get({
      user: alice.did,
      rkey: postUri.rkey,
    })
    const posts = await agent.api.app.bsky.feed.post.list({ user: alice.did })
    expect(posts.records.map((r) => r.uri)).toContain(post.uri)

    const { data: action } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.repo.recordRef',
            uri: postUri.toString(),
          },
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const postTakedownPromise = agent.api.app.bsky.feed.post.get({
      user: alice.did,
      rkey: postUri.rkey,
    })
    await expect(postTakedownPromise).rejects.toThrow('Could not locate record')
    const postsTakedown = await agent.api.app.bsky.feed.post.list({
      user: alice.did,
    })
    expect(postsTakedown.records.map((r) => r.uri)).not.toContain(post.uri)

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: action.id,
        createdBy: 'X',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })
})
