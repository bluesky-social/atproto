import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { forSnapshot } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { RecordRef } from '@atproto/bsky/tests/seeds/client'
import { BlockedActorError } from '@atproto/api/src/client/types/app/bsky/feed/getAuthorFeed'
import { BlockedByActorError } from '@atproto/api/src/client/types/app/bsky/feed/getAuthorFeed'

describe('pds views with blocking from block lists', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let aliceReplyToDan: { ref: RecordRef }

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'views_block_lists',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    // add follows to ensure blocks work even w follows
    await sc.follow(carol, dan)
    await sc.follow(dan, carol)
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

  let listUri: string

  it('creates a list with some items', async () => {
    const avatar = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-portrait-small.jpg',
      'image/jpeg',
    )
    // alice creates block list with bob & carol that dan uses
    const list = await pdsAgent.api.app.bsky.graph.list.create(
      { repo: alice },
      {
        name: 'alice blocks',
        purpose: 'app.bsky.graph.defs#blocklist',
        description: 'big list of blocks',
        avatar: avatar.image,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    listUri = list.uri
    await pdsAgent.api.app.bsky.graph.listitem.create(
      { repo: alice },
      {
        subject: sc.dids.bob,
        list: list.uri,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    await pdsAgent.api.app.bsky.graph.listitem.create(
      { repo: alice },
      {
        subject: sc.dids.carol,
        list: list.uri,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    await network.processAll()
  })

  it('uses a list for blocks', async () => {
    await pdsAgent.api.app.bsky.graph.listblock.create(
      { repo: dan },
      {
        subject: listUri,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(dan),
    )
    await network.processAll()
  })

  it('blocks thread post', async () => {
    const { carol, dan } = sc.dids
    const { data: threadAlice } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[carol][0].ref.uriStr },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(threadAlice.thread).toEqual(
      expect.objectContaining({
        $type: 'app.bsky.feed.defs#blockedPost',
        uri: sc.posts[carol][0].ref.uriStr,
        blocked: true,
      }),
    )
    const { data: threadCarol } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[dan][0].ref.uriStr },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(threadCarol.thread).toEqual(
      expect.objectContaining({
        $type: 'app.bsky.feed.defs#blockedPost',
        uri: sc.posts[dan][0].ref.uriStr,
        blocked: true,
      }),
    )
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
      resDan.data.feed.some((post) =>
        [bob, carol].includes(post.post.author.did),
      ),
    ).toBeFalsy()
  })

  it('returns block status on getProfile', async () => {
    const resCarol = await agent.api.app.bsky.actor.getProfile(
      { actor: dan },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(resCarol.data.viewer?.blocking).toBeUndefined()
    expect(resCarol.data.viewer?.blockedBy).toBe(true)

    const resDan = await agent.api.app.bsky.actor.getProfile(
      { actor: carol },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(resDan.data.viewer?.blocking).toBeDefined()
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
      { headers: await network.serviceHeaders(carol) },
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
    await network.processAll()

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

  it('returns the contents of a list', async () => {
    const res = await agent.api.app.bsky.graph.getList(
      { list: listUri },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('paginates getList', async () => {
    const full = await agent.api.app.bsky.graph.getList(
      { list: listUri },
      { headers: await network.serviceHeaders(dan) },
    )
    const first = await agent.api.app.bsky.graph.getList(
      { list: listUri, limit: 1 },
      { headers: await network.serviceHeaders(dan) },
    )
    const second = await agent.api.app.bsky.graph.getList(
      { list: listUri, cursor: first.data.cursor },
      { headers: await network.serviceHeaders(dan) },
    )
    const combined = [...first.data.items, ...second.data.items]
    expect(combined).toEqual(full.data.items)
  })

  let otherListUri: string

  it('returns lists associated with a user', async () => {
    const listRes = await pdsAgent.api.app.bsky.graph.list.create(
      { repo: alice },
      {
        name: 'new list',
        purpose: 'app.bsky.graph.defs#blocklist',
        description: 'blah blah',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    otherListUri = listRes.uri
    await network.processAll()

    const res = await agent.api.app.bsky.graph.getLists(
      { actor: alice },
      { headers: await network.serviceHeaders(dan) },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('paginates getLists', async () => {
    const full = await agent.api.app.bsky.graph.getLists(
      { actor: alice },
      { headers: await network.serviceHeaders(dan) },
    )
    const first = await agent.api.app.bsky.graph.getLists(
      { actor: alice, limit: 1 },
      { headers: await network.serviceHeaders(dan) },
    )
    const second = await agent.api.app.bsky.graph.getLists(
      { actor: alice, cursor: first.data.cursor },
      { headers: await network.serviceHeaders(dan) },
    )
    const combined = [...first.data.lists, ...second.data.lists]
    expect(combined).toEqual(full.data.lists)
  })

  it('returns a users own list blocks', async () => {
    await pdsAgent.api.app.bsky.graph.listblock.create(
      { repo: dan },
      {
        subject: otherListUri,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(dan),
    )
    await network.processAll()

    const res = await agent.api.app.bsky.graph.getListBlocks(
      {},
      { headers: await network.serviceHeaders(dan) },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('paginates getListBlocks', async () => {
    const full = await agent.api.app.bsky.graph.getListBlocks(
      {},
      { headers: await network.serviceHeaders(dan) },
    )
    const first = await agent.api.app.bsky.graph.getListBlocks(
      { limit: 1 },
      { headers: await network.serviceHeaders(dan) },
    )
    const second = await agent.api.app.bsky.graph.getListBlocks(
      { cursor: first.data.cursor },
      { headers: await network.serviceHeaders(dan) },
    )
    const combined = [...first.data.lists, ...second.data.lists]
    expect(combined).toEqual(full.data.lists)
  })
})
