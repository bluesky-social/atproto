import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { com } from '../src/lexicons/index.js'
import usersSeed from './seeds/users'

describe('spaces', () => {
  let network: TestNetworkNoAppView
  let client: Client
  let sc: SeedClient

  let aliceHeaders: { authorization: string }
  let bobHeaders: { authorization: string }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'spaces',
    })
    client = network.pds.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)

    aliceHeaders = sc.getHeaders(sc.dids.alice)
    bobHeaders = sc.getHeaders(sc.dids.bob)
  })

  afterAll(async () => {
    await network.close()
  })

  let spaceUri: string

  it('creates a space', async () => {
    const res = await client.call(
      com.atproto.space.createSpace,
      {
        did: sc.dids.alice,
        type: 'app.bsky.group',
        skey: 'test',
      },
      { headers: aliceHeaders },
    )
    spaceUri = res.uri
    expect(spaceUri).toBe(`ats://${sc.dids.alice}/app.bsky.group/test`)
  })

  it('lists spaces', async () => {
    const res = await client.call(
      com.atproto.space.listSpaces,
      {},
      {
        headers: aliceHeaders,
      },
    )
    expect(res.spaces.length).toBe(1)
    expect(res.spaces[0].uri).toBe(spaceUri)
    expect(res.spaces[0].isOwner).toBe(true)
  })

  it('creates a record in a space', async () => {
    const record = {
      $type: 'app.bsky.feed.post',
      text: 'hello space',
      createdAt: new Date().toISOString(),
    }
    const created = await client.call(
      com.atproto.space.createRecord,
      {
        space: spaceUri,
        collection: 'app.bsky.feed.post',
        record,
      },
      { headers: aliceHeaders },
    )
    expect(created.uri).toBeDefined()
    expect(created.cid).toBeDefined()

    const rkey = created.uri.split('/').pop()!
    const got = await client.call(
      com.atproto.space.getRecord,
      {
        space: spaceUri,
        collection: 'app.bsky.feed.post',
        rkey,
      },
      { headers: aliceHeaders },
    )
    expect(got.value).toMatchObject({ text: 'hello space' })
  })

  it('lists records in a space', async () => {
    // add a couple more records
    for (let i = 0; i < 3; i++) {
      await client.call(
        com.atproto.space.createRecord,
        {
          space: spaceUri,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: `post ${i}`,
            createdAt: new Date().toISOString(),
          },
        },
        { headers: aliceHeaders },
      )
    }

    const res = await client.call(
      com.atproto.space.listRecords,
      {
        space: spaceUri,
        collection: 'app.bsky.feed.post',
      },
      { headers: aliceHeaders },
    )
    expect(res.records.length).toBe(4) // 1 from earlier + 3 new
    for (const rec of res.records) {
      expect(rec.cid).toBeDefined()
      expect(rec.rkey).toBeDefined()
    }
  })

  it('adds a member to a space', async () => {
    await client.call(
      com.atproto.space.addMember,
      { space: spaceUri, did: sc.dids.bob },
      { headers: aliceHeaders },
    )
    const res = await client.call(
      com.atproto.space.listSpaces,
      {},
      { headers: bobHeaders },
    )
    expect(res.spaces.length).toBe(1)
    expect(res.spaces[0].uri).toBe(spaceUri)
    expect(res.spaces[0].isOwner).toBe(false)
  })

  it('non-owner cannot add members', async () => {
    const promise = client.call(
      com.atproto.space.addMember,
      { space: spaceUri, did: sc.dids.carol },
      { headers: bobHeaders },
    )
    await expect(promise).rejects.toThrow('Not the space owner')
  })

  it('removes a member from a space', async () => {
    await client.call(
      com.atproto.space.removeMember,
      { space: spaceUri, did: sc.dids.bob },
      { headers: aliceHeaders },
    )
    const res = await client.call(
      com.atproto.space.listSpaces,
      {},
      { headers: bobHeaders },
    )
    expect(res.spaces).toEqual([])
  })
})
