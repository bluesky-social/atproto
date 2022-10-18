import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import * as Post from '@atproto/api/src/types/app/bsky/post'
import { AtUri } from '@atproto/uri'
import { CloseFn, paginateAll, runTestServer } from './_util'

const alice = {
  email: 'alice@test.com',
  username: 'alice.test',
  did: '',
  password: 'alice-pass',
}
const bob = {
  email: 'bob@test.com',
  username: 'bob.test',
  did: '',
  password: 'bob-pass',
}

describe('crud operations', () => {
  let client: AtpServiceClient
  let aliceClient: AtpServiceClient
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'crud',
    })
    close = server.close
    client = AtpApi.service(server.url)
    aliceClient = AtpApi.service(server.url)
  })

  afterAll(async () => {
    await close()
  })

  it('registers users', async () => {
    const res = await client.com.atproto.createAccount(
      {},
      {
        email: alice.email,
        username: alice.username,
        password: alice.password,
      },
    )
    aliceClient.setHeader('authorization', `Bearer ${res.data.jwt}`)
    alice.did = res.data.did
    const res2 = await client.com.atproto.createAccount(
      {},
      {
        email: bob.email,
        username: bob.username,
        password: bob.password,
      },
    )
    bob.did = res2.data.did
  })

  it('describes repo', async () => {
    const description = await client.com.atproto.repoDescribe({
      user: alice.did,
    })
    expect(description.data.name).toBe(alice.username)
    expect(description.data.did).toBe(alice.did)
    const description2 = await client.com.atproto.repoDescribe({
      user: bob.did,
    })
    expect(description2.data.name).toBe(bob.username)
    expect(description2.data.did).toBe(bob.did)
  })

  let uri: AtUri
  it('creates records', async () => {
    const res = await aliceClient.com.atproto.repoCreateRecord(
      { did: alice.did, collection: 'app.bsky.post' },
      {
        $type: 'app.bsky.post',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      },
    )
    uri = new AtUri(res.data.uri)
    expect(res.data.uri).toBe(`at://${alice.did}/app.bsky.post/${uri.rkey}`)
  })

  it('lists records', async () => {
    const res1 = await client.com.atproto.repoListRecords({
      user: alice.did,
      collection: 'app.bsky.post',
    })
    expect(res1.data.records.length).toBe(1)
    expect(res1.data.records[0].uri).toBe(uri.toString())
    expect((res1.data.records[0].value as Post.Record).text).toBe(
      'Hello, world!',
    )

    const res2 = await client.app.bsky.post.list({
      user: alice.did,
    })
    expect(res2.records.length).toBe(1)
    expect(res2.records[0].uri).toBe(uri.toString())
    expect(res2.records[0].value.text).toBe('Hello, world!')
  })

  it('gets records', async () => {
    const res1 = await client.com.atproto.repoGetRecord({
      user: alice.did,
      collection: 'app.bsky.post',
      rkey: uri.rkey,
    })
    expect(res1.data.uri).toBe(uri.toString())
    expect((res1.data.value as Post.Record).text).toBe('Hello, world!')

    const res2 = await client.app.bsky.post.get({
      user: alice.did,
      rkey: uri.rkey,
    })
    expect(res2.uri).toBe(uri.toString())
    expect(res2.value.text).toBe('Hello, world!')
  })

  it('deletes records', async () => {
    await aliceClient.com.atproto.repoDeleteRecord({
      did: alice.did,
      collection: 'app.bsky.post',
      rkey: uri.rkey,
    })
    const res1 = await client.com.atproto.repoListRecords({
      user: alice.did,
      collection: 'app.bsky.post',
    })
    expect(res1.data.records.length).toBe(0)
  })

  it('CRUDs records with the semantic sugars', async () => {
    const res1 = await aliceClient.app.bsky.post.create(
      { did: alice.did },
      {
        $type: 'app.bsky.post',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      },
    )
    const uri = new AtUri(res1.uri)

    const res2 = await client.app.bsky.post.list({
      user: alice.did,
    })
    expect(res2.records.length).toBe(1)

    await aliceClient.app.bsky.post.delete({
      did: alice.did,
      rkey: uri.rkey,
    })

    const res3 = await client.app.bsky.post.list({
      user: alice.did,
    })
    expect(res3.records.length).toBe(0)
  })

  it('creates records with the correct key described by the schema', async () => {
    const res1 = await aliceClient.app.bsky.profile.create(
      { did: alice.did },
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
        const res = await aliceClient.app.bsky.post.create(
          { did: alice.did },
          {
            $type: 'app.bsky.post',
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
          aliceClient.app.bsky.post.delete({
            did: alice.did,
            rkey: uri.rkey,
          }),
        ),
      )
    })

    it('in forwards order', async () => {
      const results = (results) => results.flatMap((res) => res.records)
      const paginator = async (cursor?: string) => {
        const res = await client.app.bsky.post.list({
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

      const full = await client.app.bsky.post.list({
        user: alice.did,
      })

      expect(full.records.length).toEqual(5)
      expect(results(paginatedAll)).toEqual(results([full]))
    })

    it('in reverse order', async () => {
      const results = (results) => results.flatMap((res) => res.records)
      const paginator = async (cursor?: string) => {
        const res = await client.app.bsky.post.list({
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

      const full = await client.app.bsky.post.list({
        user: alice.did,
        reverse: true,
      })

      expect(full.records.length).toEqual(5)
      expect(results(paginatedAll)).toEqual(results([full]))
    })

    it('between two records', async () => {
      const list = await client.app.bsky.post.list({
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
      const forwards = await client.app.bsky.post.list({
        user: alice.did,
      })
      const reverse = await client.app.bsky.post.list({
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

  it('requires a $type on records', async () => {
    const prom1 = aliceClient.com.atproto.repoCreateRecord(
      { did: alice.did, collection: 'app.bsky.post' },
      {},
    )
    await expect(prom1).rejects.toThrow(
      'The passed value does not declare a $type',
    )
  })

  it('requires the schema to be known if validating', async () => {
    // const prom1 = client.com.atproto.repoListRecords(url, {
    //   user: alice.did,
    //   type: 'com.example.foobar',
    // })
    // await expect(prom1).rejects.toThrow('Schema not found: com.example.foobar')
    const prom2 = aliceClient.com.atproto.repoCreateRecord(
      { did: alice.did, collection: 'com.example.foobar' },
      { $type: 'com.example.foobar' },
    )
    await expect(prom2).rejects.toThrow('Schema not found')
  })

  it('requires the $type to match the schema', async () => {
    await expect(
      aliceClient.com.atproto.repoCreateRecord(
        { did: alice.did, collection: 'app.bsky.post' },
        { $type: 'app.bsky.like' },
      ),
    ).rejects.toThrow('Record type app.bsky.like is not supported')
  })

  it('validates the record on write', async () => {
    await expect(
      aliceClient.com.atproto.repoCreateRecord(
        { did: alice.did, collection: 'app.bsky.post' },
        { $type: 'app.bsky.post' },
      ),
    ).rejects.toThrow(
      "Failed app.bsky.post validation for #/required: must have required property 'text'",
    )
  })

  // TODO: does it?
  // it('validates the record on read', async () => {
  //   const res1 = await client.com.atproto.repoCreateRecord(
  //     url,
  //     { did: alice.did, type: 'app.bsky.post', validate: false },
  //     {
  //       encoding: 'application/json',
  //       data: { $type: 'app.bsky.post', record: 'is bad' },
  //     },
  //   )
  //   const res2 = await client.com.atproto.repoCreateRecord(
  //     url,
  //     { did: alice.did, type: 'app.bsky.post', validate: false },
  //     {
  //       encoding: 'application/json',
  //       data: { $type: 'com.example.unknown', dunno: 'lol' },
  //     },
  //   )
  //   const res3 = await client.com.atproto.repoListRecords(url, {
  //     user: alice.did,
  //     type: 'app.bsky.post',
  //   })
  //   /** @ts-ignore TODO!!! */
  //   expect(res3.data.records[0].value.record).toBe('is bad')
  //   /** @ts-ignore TODO!!! */
  //   expect(res3.data.records[0].valid).toBeFalsy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res3.data.records[0].fullySupported).toBeFalsy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res3.data.records[0].compatible).toBeTruthy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res3.data.records[0].error).toBe(
  //     `Failed app.bsky.post validation for #/required: must have required property 'text'`,
  //   )
  //   /** @ts-ignore TODO!!! */
  //   expect(res3.data.records[1].value.dunno).toBe('lol')
  //   /** @ts-ignore TODO!!! */
  //   expect(res3.data.records[1].valid).toBeFalsy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res3.data.records[1].fullySupported).toBeFalsy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res3.data.records[1].compatible).toBeFalsy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res3.data.records[1].error).toBe(
  //     `Record type com.example.unknown is not supported`,
  //   )
  //   const res4 = await client.com.atproto.repoGetRecord(url, {
  //     user: alice.did,
  //     type: 'app.bsky.post',
  //     tid: new AtUri(res1.data.uri).rkey,
  //   })
  //   /** @ts-ignore TODO!!! */
  //   expect(res4.data.value.record).toBe('is bad')
  //   /** @ts-ignore TODO!!! */
  //   expect(res4.data.valid).toBeFalsy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res4.data.fullySupported).toBeFalsy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res4.data.compatible).toBeTruthy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res4.data.error).toBe(
  //     `Failed app.bsky.post validation for #/required: must have required property 'text'`,
  //   )
  //   const res5 = await client.com.atproto.repoGetRecord(url, {
  //     user: alice.did,
  //     type: 'app.bsky.post',
  //     tid: new AtUri(res2.data.uri).rkey,
  //   })
  //   /** @ts-ignore TODO!!! */
  //   expect(res5.data.value.dunno).toBe('lol')
  //   /** @ts-ignore TODO!!! */
  //   expect(res5.data.valid).toBeFalsy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res5.data.fullySupported).toBeFalsy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res5.data.compatible).toBeFalsy()
  //   /** @ts-ignore TODO!!! */
  //   expect(res5.data.error).toBe(
  //     `Record type com.example.unknown is not supported`,
  //   )
  //   await client.com.atproto.repoDeleteRecord(url, {
  //     did: alice.did,
  //     type: 'app.bsky.post',
  //     tid: new AtUri(res1.data.uri).rkey,
  //   })
  //   await client.com.atproto.repoDeleteRecord(url, {
  //     did: alice.did,
  //     type: 'app.bsky.post',
  //     tid: new AtUri(res2.data.uri).rkey,
  //   })
  // })
})
