import AtpAgent from '@atproto/api'
import { BlockedActorError } from '@atproto/api/src/client/types/app/bsky/feed/getAuthorFeed'
import { BlockedByActorError } from '@atproto/api/src/client/types/app/bsky/feed/getAuthorFeed'
import { TestNetwork } from '@atproto/dev-env'
import { forSnapshot } from '../_util'
import { RecordRef, SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds views with blocking', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let aliceReplyToDan: { ref: RecordRef }

  let alice: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_block',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    alice = sc.dids.alice
    carol = sc.dids.carol
    dan = sc.dids.dan
    // add follows to ensure blocks work even w follows
    await sc.follow(carol, dan)
    await sc.follow(dan, carol)
    // dan blocks carol
    await pdsAgent.api.app.bsky.graph.block.create(
      { repo: dan },
      { createdAt: new Date().toISOString(), subject: carol },
      sc.getHeaders(dan),
    )
    aliceReplyToDan = await sc.reply(
      alice,
      sc.posts[dan][0].ref,
      sc.posts[dan][0].ref,
      'alice replies to dan',
    )
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('blocks thread post', async () => {
    const { carol, dan } = sc.dids
    const { data: threadAlice } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[carol][0].ref.uriStr },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(threadAlice).toEqual({
      thread: {
        $type: 'app.bsky.feed.defs#blockedPost',
        uri: sc.posts[carol][0].ref.uriStr,
        blocked: true,
      },
    })
    const { data: threadCarol } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[dan][0].ref.uriStr },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(threadCarol).toEqual({
      thread: {
        $type: 'app.bsky.feed.defs#blockedPost',
        uri: sc.posts[dan][0].ref.uriStr,
        blocked: true,
      },
    })
  })

  it('blocks thread reply', async () => {
    // Contains reply by carol
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('blocks thread parent', async () => {
    // Parent is a post by dan
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: aliceReplyToDan.ref.uriStr },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('blocks record embeds', async () => {
    // Contains a deep embed of carol's post, blocked by dan
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 0, uri: sc.posts[alice][2].ref.uriStr },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('errors on getting author feed', async () => {
    const attempt1 = agent.api.app.bsky.feed.getAuthorFeed(
      { actor: carol },
      { headers: await network.serviceHeaders(dan) },
    )
    await expect(attempt1).rejects.toThrow(BlockedActorError)

    const attempt2 = agent.api.app.bsky.feed.getAuthorFeed(
      { actor: dan },
      { headers: await network.serviceHeaders(carol) },
    )
    await expect(attempt2).rejects.toThrow(BlockedByActorError)
  })

  it('strips blocked users out of getTimeline', async () => {
    const resCarol = await agent.api.app.bsky.feed.getTimeline(
      { limit: 100 },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(
      resCarol.data.feed.some((post) => post.post.author.did === dan),
    ).toBeFalsy()

    const resDan = await agent.api.app.bsky.feed.getTimeline(
      { limit: 100 },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(
      resDan.data.feed.some((post) => post.post.author.did === carol),
    ).toBeFalsy()
  })

  it('returns block status on getProfile', async () => {
    const resCarol = await agent.api.app.bsky.actor.getProfile(
      { actor: dan },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(resCarol.data.viewer?.blocking).toBeUndefined
    expect(resCarol.data.viewer?.blockedBy).toBe(true)

    const resDan = await agent.api.app.bsky.actor.getProfile(
      { actor: carol },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(resDan.data.viewer?.blocking).toBeDefined
    expect(resDan.data.viewer?.blockedBy).toBe(false)
  })

  it('returns block status on getProfiles', async () => {
    const resCarol = await agent.api.app.bsky.actor.getProfiles(
      { actors: [alice, dan] },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(resCarol.data.profiles[0].viewer?.blocking).toBeUndefined()
    expect(resCarol.data.profiles[0].viewer?.blockedBy).toBe(false)
    expect(resCarol.data.profiles[1].viewer?.blocking).toBeUndefined()
    expect(resCarol.data.profiles[1].viewer?.blockedBy).toBe(true)

    const resDan = await agent.api.app.bsky.actor.getProfiles(
      { actors: [alice, carol] },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(resDan.data.profiles[0].viewer?.blocking).toBeUndefined()
    expect(resDan.data.profiles[0].viewer?.blockedBy).toBe(false)
    expect(resDan.data.profiles[1].viewer?.blocking).toBeDefined()
    expect(resDan.data.profiles[1].viewer?.blockedBy).toBe(false)
  })

  it('does not return notifs for blocked accounts', async () => {
    const resCarol = await agent.api.app.bsky.notification.listNotifications(
      {
        limit: 100,
      },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(
      resCarol.data.notifications.some((notif) => notif.author.did === dan),
    ).toBeFalsy()

    const resDan = await agent.api.app.bsky.notification.listNotifications(
      {
        limit: 100,
      },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(
      resDan.data.notifications.some((notif) => notif.author.did === carol),
    ).toBeFalsy()
  })

  it('does not return blocked accounts in actor search', async () => {
    const resCarol = await agent.api.app.bsky.actor.searchActors(
      {
        term: 'dan.test',
      },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(resCarol.data.actors.some((actor) => actor.did === dan)).toBeFalsy()

    const resDan = await agent.api.app.bsky.actor.searchActors(
      {
        term: 'carol.test',
      },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(resDan.data.actors.some((actor) => actor.did === carol)).toBeFalsy()
  })

  it('does not return blocked accounts in actor search typeahead', async () => {
    const resCarol = await agent.api.app.bsky.actor.searchActorsTypeahead(
      {
        term: 'dan.test',
      },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(resCarol.data.actors.some((actor) => actor.did === dan)).toBeFalsy()

    const resDan = await agent.api.app.bsky.actor.searchActorsTypeahead(
      {
        term: 'carol.test',
      },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(resDan.data.actors.some((actor) => actor.did === carol)).toBeFalsy()
  })

  it('does not return blocked accounts in get suggestions', async () => {
    // unfollow so they _would_ show up in suggestions if not for block
    await sc.unfollow(carol, dan)
    await sc.unfollow(dan, carol)

    const resCarol = await agent.api.app.bsky.actor.getSuggestions(
      {
        limit: 100,
      },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(resCarol.data.actors.some((actor) => actor.did === dan)).toBeFalsy()

    const resDan = await agent.api.app.bsky.actor.getSuggestions(
      {
        limit: 100,
      },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(resDan.data.actors.some((actor) => actor.did === carol)).toBeFalsy()
  })

  it('returns a list of blocks', async () => {
    await pdsAgent.api.app.bsky.graph.block.create(
      { repo: dan },
      { createdAt: new Date().toISOString(), subject: alice },
      sc.getHeaders(dan),
    )

    await network.processAll()

    const res = await agent.api.app.bsky.graph.getBlocks(
      {},
      { headers: await network.serviceHeaders(dan) },
    )
    const dids = res.data.blocks.map((block) => block.did).sort()
    expect(dids).toEqual([alice, carol].sort())
  })

  it('paginates getBlocks', async () => {
    const full = await agent.api.app.bsky.graph.getBlocks(
      {},
      { headers: await network.serviceHeaders(dan) },
    )
    const first = await agent.api.app.bsky.graph.getBlocks(
      { limit: 1 },
      { headers: await network.serviceHeaders(dan) },
    )
    const second = await agent.api.app.bsky.graph.getBlocks(
      { cursor: first.data.cursor },
      { headers: await network.serviceHeaders(dan) },
    )
    const combined = [...first.data.blocks, ...second.data.blocks]
    expect(combined).toEqual(full.data.blocks)
  })
})
