import assert from 'node:assert'
import { AppBskyLabelerDefs, AtpAgent } from '@atproto/api'
import { RecordRef, SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'

describe('bsky takedown labels', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
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
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)

    aliceListRef = await sc.createList(sc.dids.alice, 'alice list', 'mod')
    // carol blocks dan via alice's (takendown) list
    await sc.addToList(sc.dids.alice, sc.dids.dan, aliceListRef)
    await pdsAgent.app.bsky.graph.listblock.create(
      { repo: sc.dids.carol },
      {
        subject: aliceListRef.uriStr,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.carol),
    )
    carolListRef = await sc.createList(sc.dids.carol, 'carol list', 'mod')
    // alice blocks dan via carol's list, and carol is takendown
    await sc.addToList(sc.dids.carol, sc.dids.dan, carolListRef)
    await pdsAgent.app.bsky.graph.listblock.create(
      { repo: sc.dids.alice },
      {
        subject: carolListRef.uriStr,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.alice),
    )
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

    // labelers
    await sc.createAccount('labeler1', {
      email: 'lab1@test.com',
      handle: 'lab1.test',
      password: 'lab1',
    })
    await sc.agent.api.com.atproto.repo.createRecord(
      {
        repo: sc.dids.labeler1,
        collection: ids.AppBskyLabelerService,
        rkey: 'self',
        record: {
          policies: { labelValues: ['spam'] },
          createdAt: new Date().toISOString(),
        },
      },
      {
        headers: sc.getHeaders(sc.dids.labeler1),
        encoding: 'application/json',
      },
    )
    await sc.createAccount('labeler2', {
      email: 'lab2@test.com',
      handle: 'lab2.test',
      password: 'lab2',
    })
    await sc.agent.api.com.atproto.repo.createRecord(
      {
        repo: sc.dids.labeler2,
        collection: ids.AppBskyLabelerService,
        rkey: 'self',
        record: {
          policies: { labelValues: ['spam'] },
          createdAt: new Date().toISOString(),
        },
      },
      {
        headers: sc.getHeaders(sc.dids.labeler2),
        encoding: 'application/json',
      },
    )

    await network.processAll()

    takendownSubjects = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.dids.carol,
      aliceListRef.uriStr,
      aliceGenRef.uriStr,
      sc.dids.labeler1,
    ]
    const src = network.ozone.ctx.cfg.service.did
    const cts = new Date().toISOString()
    const labels = takendownSubjects.map((uri) => ({
      src,
      uri,
      cid: '',
      val: '!takedown',
      exp: null,
      neg: false,
      cts,
    }))
    AtpAgent.configure({ appLabelers: [src] })

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

  it('halts application of mod lists', async () => {
    const { data: profile } = await agent.app.bsky.actor.getProfile(
      {
        actor: sc.dids.dan, // blocked via alice's takendown list
      },
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyActorGetProfile,
        ),
      },
    )
    expect(profile.did).toBe(sc.dids.dan)
    expect(profile.viewer).not.toBeUndefined()
    expect(profile.viewer?.blockedBy).toBe(false)
    expect(profile.viewer?.blocking).toBeUndefined()
    expect(profile.viewer?.blockingByList).toBeUndefined()
  })

  it('author takedown halts application of mod lists', async () => {
    const { data: profile } = await agent.app.bsky.actor.getProfile(
      {
        actor: sc.dids.dan, // blocked via carol's list, and carol is takendown
      },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyActorGetProfile,
        ),
      },
    )
    expect(profile.did).toBe(sc.dids.dan)
    expect(profile.viewer).not.toBeUndefined()
    expect(profile.viewer?.blockedBy).toBe(false)
    expect(profile.viewer?.blocking).toBeUndefined()
    expect(profile.viewer?.blockingByList).toBeUndefined()
  })

  it('takesdown feed generators', async () => {
    const res = await agent.api.app.bsky.feed.getFeedGenerators({
      feeds: [aliceGenRef.uriStr, bobGenRef.uriStr, carolGenRef.uriStr],
    })
    expect(res.data.feeds.length).toBe(1)
    expect(res.data.feeds.at(0)?.uri).toEqual(bobGenRef.uriStr)
  })

  it('takesdown labelers', async () => {
    const res = await agent.api.app.bsky.labeler.getServices({
      dids: [sc.dids.labeler1, sc.dids.labeler2],
    })
    expect(res.data.views.length).toBe(1)
    assert(AppBskyLabelerDefs.isLabelerView(res.data.views[0]))
    expect(res.data.views[0].creator.did).toBe(sc.dids.labeler2)
  })

  it('only applies if the relevant labeler is configured', async () => {
    AtpAgent.configure({ appLabelers: ['did:web:example.com'] })
    const res = await agent.api.app.bsky.actor.getProfile({
      actor: sc.dids.carol,
    })
    expect(res.data.did).toEqual(sc.dids.carol)
  })
})
