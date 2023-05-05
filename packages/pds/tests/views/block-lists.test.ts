import AtpAgent from '@atproto/api'
import { runTestServer, CloseFn, TestServerInfo, forSnapshot } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { RecordRef } from '@atproto/bsky/tests/seeds/client'
import { BlockedActorError } from '@atproto/api/src/client/types/app/bsky/feed/getAuthorFeed'
import { BlockedByActorError } from '@atproto/api/src/client/types/app/bsky/feed/getAuthorFeed'

describe('pds views with blocking from block lists', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient
  let aliceReplyToDan: { ref: RecordRef }

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'views_block_lists',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
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
    await server.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await close()
  })

  let listUri: string

  it('creates a list with some items', async () => {
    const avatar = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-portrait-small.jpg',
      'image/jpeg',
    )
    // alice creates block list with bob & carol that dan uses
    const list = await agent.api.app.bsky.graph.list.create(
      { repo: alice },
      {
        name: 'alice blocks',
        description: 'big list of blocks',
        avatar: avatar.image,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    listUri = list.uri
    await agent.api.app.bsky.graph.listitem.create(
      { repo: alice },
      {
        subject: sc.dids.bob,
        list: list.uri,
        reason: 'because',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    await agent.api.app.bsky.graph.listitem.create(
      { repo: alice },
      {
        subject: sc.dids.carol,
        list: list.uri,
        reason: 'idk',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
  })

  it('uses a list for blocks', async () => {
    await agent.api.app.bsky.graph.listblock.create(
      { repo: dan },
      {
        subject: listUri,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(dan),
    )
  })

  it('blocks thread post', async () => {
    const { carol, dan } = sc.dids
    const { data: threadAlice } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[carol][0].ref.uriStr },
      { headers: sc.getHeaders(dan) },
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
      { headers: sc.getHeaders(carol) },
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
      { headers: sc.getHeaders(dan) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('blocks thread parent', async () => {
    // Parent is a post by dan
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: aliceReplyToDan.ref.uriStr },
      { headers: sc.getHeaders(carol) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('blocks record embeds', async () => {
    // Contains a deep embed of carol's post, blocked by dan
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 0, uri: sc.posts[alice][2].ref.uriStr },
      { headers: sc.getHeaders(dan) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('errors on getting author feed', async () => {
    const attempt1 = agent.api.app.bsky.feed.getAuthorFeed(
      { actor: carol },
      { headers: sc.getHeaders(dan) },
    )
    await expect(attempt1).rejects.toThrow(BlockedActorError)

    const attempt2 = agent.api.app.bsky.feed.getAuthorFeed(
      { actor: dan },
      { headers: sc.getHeaders(carol) },
    )
    await expect(attempt2).rejects.toThrow(BlockedByActorError)
  })

  it('strips blocked users out of getTimeline', async () => {
    const resCarol = await agent.api.app.bsky.unspecced.getPopular(
      { limit: 100 },
      { headers: sc.getHeaders(carol) },
    )
    expect(
      resCarol.data.feed.some((post) => post.post.author.did === dan),
    ).toBeFalsy()

    const resDan = await agent.api.app.bsky.unspecced.getPopular(
      { limit: 100 },
      { headers: sc.getHeaders(carol) },
    )
    expect(
      resDan.data.feed.some((post) =>
        [bob, carol].includes(post.post.author.did),
      ),
    ).toBeFalsy()
  })

  it('strips blocked users out of getPopular', async () => {
    for (let i = 0; i < 15; i++) {
      const name = `user${i}`
      await sc.createAccount(name, {
        handle: `user${i}.test`,
        email: `user${i}@test.com`,
        password: 'password',
      })
      await sc.like(sc.dids[name], sc.posts[alice][0].ref)
      await sc.like(sc.dids[name], sc.posts[bob][0].ref)
      await sc.like(sc.dids[name], sc.posts[carol][0].ref)
      await sc.like(sc.dids[name], sc.posts[dan][0].ref)
    }

    const resCarol = await agent.api.app.bsky.unspecced.getPopular(
      {},
      { headers: sc.getHeaders(carol) },
    )
    expect(
      resCarol.data.feed.some((post) => post.post.author.did === alice),
    ).toBeTruthy()
    expect(
      resCarol.data.feed.some((post) => post.post.author.did === carol),
    ).toBeTruthy()
    expect(
      resCarol.data.feed.some((post) => post.post.author.did === dan),
    ).toBeFalsy()

    const resDan = await agent.api.app.bsky.unspecced.getPopular(
      {},
      { headers: sc.getHeaders(dan) },
    )
    expect(
      resDan.data.feed.some((post) => post.post.author.did === alice),
    ).toBeTruthy()
    expect(
      resDan.data.feed.some((post) =>
        [bob, carol].includes(post.post.author.did),
      ),
    ).toBeFalsy()
    expect(
      resDan.data.feed.some((post) => post.post.author.did === dan),
    ).toBeTruthy()
  })

  it('returns block status on getProfile', async () => {
    const resCarol = await agent.api.app.bsky.actor.getProfile(
      { actor: dan },
      { headers: sc.getHeaders(carol) },
    )
    expect(resCarol.data.viewer?.blocking).toBeUndefined
    expect(resCarol.data.viewer?.blockedBy).toBe(true)

    const resDan = await agent.api.app.bsky.actor.getProfile(
      { actor: carol },
      { headers: sc.getHeaders(dan) },
    )
    expect(resDan.data.viewer?.blocking).toBeDefined
    expect(resDan.data.viewer?.blockedBy).toBe(false)
  })

  it('returns block status on getProfiles', async () => {
    const resCarol = await agent.api.app.bsky.actor.getProfiles(
      { actors: [alice, dan] },
      { headers: sc.getHeaders(carol) },
    )
    expect(resCarol.data.profiles[0].viewer?.blocking).toBeUndefined()
    expect(resCarol.data.profiles[0].viewer?.blockedBy).toBe(false)
    expect(resCarol.data.profiles[1].viewer?.blocking).toBeUndefined()
    expect(resCarol.data.profiles[1].viewer?.blockedBy).toBe(true)

    const resDan = await agent.api.app.bsky.actor.getProfiles(
      { actors: [alice, carol] },
      { headers: sc.getHeaders(dan) },
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
      { headers: sc.getHeaders(carol) },
    )
    expect(
      resCarol.data.notifications.some((notif) => notif.author.did === dan),
    ).toBeFalsy()

    const resDan = await agent.api.app.bsky.notification.listNotifications(
      {
        limit: 100,
      },
      { headers: sc.getHeaders(carol) },
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
      { headers: sc.getHeaders(carol) },
    )
    expect(resCarol.data.actors.some((actor) => actor.did === dan)).toBeFalsy()

    const resDan = await agent.api.app.bsky.actor.searchActors(
      {
        term: 'carol.test',
      },
      { headers: sc.getHeaders(dan) },
    )
    expect(resDan.data.actors.some((actor) => actor.did === carol)).toBeFalsy()
  })

  it('does not return blocked accounts in actor search typeahead', async () => {
    const resCarol = await agent.api.app.bsky.actor.searchActorsTypeahead(
      {
        term: 'dan.test',
      },
      { headers: sc.getHeaders(carol) },
    )
    expect(resCarol.data.actors.some((actor) => actor.did === dan)).toBeFalsy()

    const resDan = await agent.api.app.bsky.actor.searchActorsTypeahead(
      {
        term: 'carol.test',
      },
      { headers: sc.getHeaders(dan) },
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
      { headers: sc.getHeaders(carol) },
    )
    expect(resCarol.data.actors.some((actor) => actor.did === dan)).toBeFalsy()

    const resDan = await agent.api.app.bsky.actor.getSuggestions(
      {
        limit: 100,
      },
      { headers: sc.getHeaders(dan) },
    )
    expect(resDan.data.actors.some((actor) => actor.did === carol)).toBeFalsy()
  })

  it('returns the contents of a list', async () => {
    const res = await agent.api.app.bsky.graph.getList(
      { list: listUri },
      { headers: sc.getHeaders(dan) },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('paginates getList', async () => {
    const full = await agent.api.app.bsky.graph.getList(
      { list: listUri },
      { headers: sc.getHeaders(dan) },
    )
    const first = await agent.api.app.bsky.graph.getList(
      { list: listUri, limit: 1 },
      { headers: sc.getHeaders(dan) },
    )
    const second = await agent.api.app.bsky.graph.getList(
      { list: listUri, cursor: first.data.cursor },
      { headers: sc.getHeaders(dan) },
    )
    const combined = [...first.data.items, ...second.data.items]
    expect(combined).toEqual(full.data.items)
  })

  let otherListUri: string

  it('returns lists associated with a user', async () => {
    const listRes = await agent.api.app.bsky.graph.list.create(
      { repo: alice },
      {
        name: 'new list',
        description: 'blah blah',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    otherListUri = listRes.uri

    const res = await agent.api.app.bsky.graph.getLists(
      { actor: alice },
      { headers: sc.getHeaders(dan) },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('paginates getLists', async () => {
    const full = await agent.api.app.bsky.graph.getLists(
      { actor: alice },
      { headers: sc.getHeaders(dan) },
    )
    const first = await agent.api.app.bsky.graph.getLists(
      { actor: alice, limit: 1 },
      { headers: sc.getHeaders(dan) },
    )
    const second = await agent.api.app.bsky.graph.getLists(
      { actor: alice, cursor: first.data.cursor },
      { headers: sc.getHeaders(dan) },
    )
    const combined = [...first.data.lists, ...second.data.lists]
    expect(combined).toEqual(full.data.lists)
  })

  it('returns a users own list blocks', async () => {
    await agent.api.app.bsky.graph.listblock.create(
      { repo: dan },
      {
        subject: listUri,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(dan),
    )

    const res = await agent.api.app.bsky.graph.getListBlocks(
      {},
      { headers: sc.getHeaders(dan) },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('paginates getListBlocks', async () => {
    const full = await agent.api.app.bsky.graph.getListBlocks(
      {},
      { headers: sc.getHeaders(dan) },
    )
    const first = await agent.api.app.bsky.graph.getListBlocks(
      { limit: 1 },
      { headers: sc.getHeaders(dan) },
    )
    const second = await agent.api.app.bsky.graph.getListBlocks(
      { cursor: first.data.cursor },
      { headers: sc.getHeaders(dan) },
    )
    const combined = [...first.data.lists, ...second.data.lists]
    expect(combined).toEqual(full.data.lists)
  })
})
