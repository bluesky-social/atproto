import AtpAgent from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed, RecordRef } from '@atproto/dev-env'

describe('bsky takedown labels', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let takendownSubjects: string[]

  let aliceListRef: RecordRef
  let carolListRef: RecordRef
  let aliceGenRef: RecordRef
  let bobGenRef: RecordRef
  let carolGenRef: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_takedown_labels',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)

    aliceListRef = await sc.createList(sc.dids.alice, 'alice list', 'mod')
    carolListRef = await sc.createList(sc.dids.carol, 'carol list', 'mod')
    aliceGenRef = await sc.createFeedGen(
      sc.dids.alice,
      'did:web:example.com',
      'alice generator',
    )
    bobGenRef = await sc.createFeedGen(
      sc.dids.bob,
      'did:web:example.com',
      'bob generator',
    )
    carolGenRef = await sc.createFeedGen(
      sc.dids.carol,
      'did:web:example.com',
      'carol generator',
    )

    await network.processAll()

    takendownSubjects = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.dids.carol,
      aliceListRef.uriStr,
      aliceGenRef.uriStr,
    ]
    const src = network.ozone.ctx.cfg.service.did
    const cts = new Date().toISOString()
    const labels = takendownSubjects.map((uri) => ({
      src,
      uri,
      cid: '',
      val: '!takedown',
      neg: false,
      cts,
    }))

    await network.bsky.db.db.insertInto('label').values(labels).execute()
  })

  afterAll(async () => {
    await network.close()
  })

  it('takesdown profiles', async () => {
    const attempt = agent.api.app.bsky.actor.getProfile({
      actor: sc.dids.carol,
    })
    await expect(attempt).rejects.toThrow('Account has been suspended')
    const res = await agent.api.app.bsky.actor.getProfiles({
      actors: [sc.dids.alice, sc.dids.bob, sc.dids.carol],
    })
    expect(res.data.profiles.length).toBe(2)
    expect(res.data.profiles.some((p) => p.did === sc.dids.carol)).toBe(false)
  })

  it('takesdown posts', async () => {
    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][1].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      sc.posts[sc.dids.carol][0].ref.uriStr,
      sc.posts[sc.dids.dan][1].ref.uriStr,
      sc.replies[sc.dids.alice][0].ref.uriStr,
    ]
    const res = await agent.api.app.bsky.feed.getPosts({ uris })

    expect(res.data.posts.length).toBe(4)
    expect(res.data.posts.some((p) => p.author.did === sc.dids.carol)).toBe(
      false,
    )
    expect(
      res.data.posts.some(
        (p) => p.uri === sc.posts[sc.dids.alice][0].ref.uriStr,
      ),
    ).toBe(false)
  })

  it('takesdown lists', async () => {
    // record takedown
    const attempt1 = agent.api.app.bsky.graph.getList({
      list: aliceListRef.uriStr,
    })
    await expect(attempt1).rejects.toThrow('List not found')

    // actor takedown
    const attempt2 = agent.api.app.bsky.graph.getList({
      list: carolListRef.uriStr,
    })
    await expect(attempt2).rejects.toThrow('List not found')
  })

  it('takesdown feed generators', async () => {
    const res = await agent.api.app.bsky.feed.getFeedGenerators({
      feeds: [aliceGenRef.uriStr, bobGenRef.uriStr, carolGenRef.uriStr],
    })
    expect(res.data.feeds.length).toBe(1)
    expect(res.data.feeds.at(0)?.uri).toEqual(bobGenRef.uriStr)
  })

  it('only applies if the relevant labeler is configured', async () => {
    const res = await agent.api.app.bsky.actor.getProfile(
      {
        actor: sc.dids.carol,
      },
      { headers: { 'atproto-accept-labelers': 'did:web:example.com' } },
    )
    expect(res.data.did).toEqual(sc.dids.carol)
  })
})
