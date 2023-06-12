import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { forSnapshot } from '../_util'

describe('proxies view requests', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_views',
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await network.close()
  })

  it('actor.getProfile', async () => {
    const res = await agent.api.app.bsky.actor.getProfile(
      {
        actor: bob,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('actor.getProfiles', async () => {
    const res = await agent.api.app.bsky.actor.getProfiles(
      {
        actors: [alice, bob],
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('actor.getSuggestions', async () => {
    // mock some suggestions
    const suggestions = [
      { did: sc.dids.bob, order: 1 },
      { did: sc.dids.carol, order: 2 },
      { did: sc.dids.dan, order: 3 },
    ]
    await network.bsky.ctx.db.db
      .insertInto('suggested_follow')
      .values(suggestions)
      .execute()

    const res = await agent.api.app.bsky.actor.getSuggestions(
      {},
      {
        headers: { ...sc.getHeaders(carol), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
    const pt1 = await agent.api.app.bsky.actor.getSuggestions(
      {
        limit: 1,
      },
      {
        headers: { ...sc.getHeaders(carol), 'x-appview-proxy': 'true' },
      },
    )
    const pt2 = await agent.api.app.bsky.actor.getSuggestions(
      {
        cursor: pt1.data.cursor,
      },
      {
        headers: { ...sc.getHeaders(carol), 'x-appview-proxy': 'true' },
      },
    )
    expect([...pt1.data.actors, ...pt2.data.actors]).toEqual(res.data.actors)
  })

  it('actor.searchActor', async () => {
    const res = await agent.api.app.bsky.actor.searchActors(
      {
        term: '.test',
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
    const pt1 = await agent.api.app.bsky.actor.searchActors(
      {
        term: '.test',
        limit: 1,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const pt2 = await agent.api.app.bsky.actor.searchActors(
      {
        term: '.test',
        cursor: pt1.data.cursor,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect([...pt1.data.actors, ...pt2.data.actors]).toEqual(res.data.actors)
  })

  it('actor.searchActorTypeahead', async () => {
    const res = await agent.api.app.bsky.actor.searchActorsTypeahead(
      {
        term: '.test',
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('feed.getAuthorFeed', async () => {
    const res = await agent.api.app.bsky.feed.getAuthorFeed(
      {
        actor: bob,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
    const pt1 = await agent.api.app.bsky.feed.getAuthorFeed(
      {
        actor: bob,
        limit: 1,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const pt2 = await agent.api.app.bsky.feed.getAuthorFeed(
      {
        actor: bob,
        cursor: pt1.data.cursor,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect([...pt1.data.feed, ...pt2.data.feed]).toEqual(res.data.feed)
  })

  it('feed.getLikes', async () => {
    const postUri = sc.posts[carol][0].ref.uriStr
    const res = await agent.api.app.bsky.feed.getLikes(
      {
        uri: postUri,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
    const pt1 = await agent.api.app.bsky.feed.getLikes(
      {
        uri: postUri,
        limit: 1,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const pt2 = await agent.api.app.bsky.feed.getLikes(
      {
        uri: postUri,
        cursor: pt1.data.cursor,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect([...pt1.data.likes, ...pt2.data.likes]).toEqual(res.data.likes)
  })

  it('feed.getRepostedBy', async () => {
    const postUri = sc.posts[dan][1].ref.uriStr
    const res = await agent.api.app.bsky.feed.getRepostedBy(
      {
        uri: postUri,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
    const pt1 = await agent.api.app.bsky.feed.getRepostedBy(
      {
        uri: postUri,
        limit: 1,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const pt2 = await agent.api.app.bsky.feed.getRepostedBy(
      {
        uri: postUri,
        cursor: pt1.data.cursor,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect([...pt1.data.repostedBy, ...pt2.data.repostedBy]).toEqual(
      res.data.repostedBy,
    )
  })

  it('feed.getPosts', async () => {
    const uris = [sc.posts[bob][0].ref.uriStr, sc.posts[carol][0].ref.uriStr]
    const res = await agent.api.app.bsky.feed.getPosts(
      {
        uris,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('feed.getTimeline', async () => {
    const res = await agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
    const pt1 = await agent.api.app.bsky.feed.getTimeline(
      {
        limit: 2,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const pt2 = await agent.api.app.bsky.feed.getTimeline(
      {
        cursor: pt1.data.cursor,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect([...pt1.data.feed, ...pt2.data.feed]).toEqual(res.data.feed)
  })

  // @TODO add a block here to test
  it('graph.getBlocks', async () => {
    const res = await agent.api.app.bsky.graph.getBlocks(
      {},
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
    const pt1 = await agent.api.app.bsky.graph.getBlocks(
      {
        limit: 1,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const pt2 = await agent.api.app.bsky.graph.getBlocks(
      {
        cursor: pt1.data.cursor,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect([...pt1.data.blocks, ...pt2.data.blocks]).toEqual(res.data.blocks)
  })

  it('graph.getFollows', async () => {
    const res = await agent.api.app.bsky.graph.getFollows(
      { actor: bob },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
    const pt1 = await agent.api.app.bsky.graph.getFollows(
      {
        actor: bob,
        limit: 1,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const pt2 = await agent.api.app.bsky.graph.getFollows(
      {
        actor: bob,
        cursor: pt1.data.cursor,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect([...pt1.data.follows, ...pt2.data.follows]).toEqual(res.data.follows)
  })

  it('graph.getFollowers', async () => {
    const res = await agent.api.app.bsky.graph.getFollowers(
      { actor: bob },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
    const pt1 = await agent.api.app.bsky.graph.getFollowers(
      {
        actor: bob,
        limit: 1,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const pt2 = await agent.api.app.bsky.graph.getFollowers(
      {
        actor: bob,
        cursor: pt1.data.cursor,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect([...pt1.data.followers, ...pt2.data.followers]).toEqual(
      res.data.followers,
    )
  })
})
