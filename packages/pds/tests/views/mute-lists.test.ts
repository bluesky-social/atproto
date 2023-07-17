import AtpAgent, { AtUri } from '@atproto/api'
import { runTestServer, CloseFn, TestServerInfo, forSnapshot } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { RecordRef } from '../seeds/client'

describe('pds views with mutes from mute lists', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'views_mute_lists',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    // add follows to ensure mutes work even w follows
    await sc.follow(carol, dan)
    await sc.follow(dan, carol)
    await server.processAll()
  })

  afterAll(async () => {
    await close()
  })

  let listUri: string
  let listCid: string

  it('creates a list with some items', async () => {
    const avatar = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-portrait-small.jpg',
      'image/jpeg',
    )
    // alice creates mute list with bob & carol that dan uses
    const list = await agent.api.app.bsky.graph.list.create(
      { repo: alice },
      {
        name: 'alice mutes',
        purpose: 'app.bsky.graph.defs#modlist',
        description: 'big list of mutes',
        avatar: avatar.image,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    listUri = list.uri
    listCid = list.cid
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

  it('uses a list for mutes', async () => {
    await agent.api.app.bsky.graph.muteActorList(
      {
        list: listUri,
      },
      { encoding: 'application/json', headers: sc.getHeaders(dan) },
    )
  })

  it('flags mutes in threads', async () => {
    const res = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(dan) },
    )
    expect(forSnapshot(res.data.thread)).toMatchSnapshot()
  })

  it('does not show reposted content from a muted account in  author feed', async () => {
    await sc.repost(alice, sc.posts[carol][0].ref)

    const res = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: sc.getHeaders(dan) },
    )
    expect(
      res.data.feed.some((post) => [bob, carol].includes(post.post.author.did)),
    ).toBe(false)
  })

  it('removes content from muted users on getTimeline', async () => {
    const res = await agent.api.app.bsky.feed.getTimeline(
      { limit: 100 },
      { headers: sc.getHeaders(dan) },
    )
    expect(
      res.data.feed.some((post) => [bob, carol].includes(post.post.author.did)),
    ).toBe(false)
  })

  it('flags muted users on getPopular', async () => {
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

    const res = await agent.api.app.bsky.unspecced.getPopular(
      {},
      { headers: sc.getHeaders(dan) },
    )
    expect(
      res.data.feed.some((post) => [bob, carol].includes(post.post.author.did)),
    ).toBe(false)
  })

  it('returns mute status on getProfile', async () => {
    const res = await agent.api.app.bsky.actor.getProfile(
      { actor: carol },
      { headers: sc.getHeaders(dan) },
    )
    expect(res.data.viewer?.muted).toBe(true)
    expect(res.data.viewer?.mutedByList?.uri).toBe(listUri)
  })

  it('returns mute status on getProfiles', async () => {
    const res = await agent.api.app.bsky.actor.getProfiles(
      { actors: [alice, carol] },
      { headers: sc.getHeaders(dan) },
    )
    expect(res.data.profiles[0].viewer?.muted).toBe(false)
    expect(res.data.profiles[0].viewer?.mutedByList).toBeUndefined()
    expect(res.data.profiles[1].viewer?.muted).toBe(true)
    expect(res.data.profiles[1].viewer?.mutedByList?.uri).toEqual(listUri)
  })

  it('does not return notifs for muted accounts', async () => {
    const res = await agent.api.app.bsky.notification.listNotifications(
      {
        limit: 100,
      },
      { headers: sc.getHeaders(dan) },
    )
    expect(
      res.data.notifications.some((notif) =>
        [bob, carol].includes(notif.author.did),
      ),
    ).toBeFalsy()
  })

  it('flags muted accounts in in get suggestions', async () => {
    // unfollow so they _would_ show up in suggestions if not for mute
    await sc.unfollow(dan, carol)

    const res = await agent.api.app.bsky.actor.getSuggestions(
      {
        limit: 100,
      },
      { headers: sc.getHeaders(dan) },
    )
    for (const actor of res.data.actors) {
      if ([bob, carol].includes(actor.did)) {
        expect(actor.viewer?.muted).toBe(true)
        expect(actor.viewer?.mutedByList?.uri).toEqual(listUri)
      } else {
        expect(actor.viewer?.muted).toBe(false)
        expect(actor.viewer?.mutedByList).toBeUndefined()
      }
    }
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
        purpose: 'app.bsky.graph.defs#modlist',
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

  it('returns a users own list mutes', async () => {
    await agent.api.app.bsky.graph.muteActorList(
      {
        list: otherListUri,
      },
      { encoding: 'application/json', headers: sc.getHeaders(dan) },
    )

    const res = await agent.api.app.bsky.graph.getListMutes(
      {},
      { headers: sc.getHeaders(dan) },
    )
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })

  it('paginates getListMutes', async () => {
    const full = await agent.api.app.bsky.graph.getListMutes(
      {},
      { headers: sc.getHeaders(dan) },
    )
    const first = await agent.api.app.bsky.graph.getListMutes(
      { limit: 1 },
      { headers: sc.getHeaders(dan) },
    )
    const second = await agent.api.app.bsky.graph.getListMutes(
      { cursor: first.data.cursor },
      { headers: sc.getHeaders(dan) },
    )
    const combined = [...first.data.lists, ...second.data.lists]
    expect(combined).toEqual(full.data.lists)
  })

  it('allows unsubscribing from a mute list', async () => {
    await agent.api.app.bsky.graph.unmuteActorList(
      {
        list: otherListUri,
      },
      { encoding: 'application/json', headers: sc.getHeaders(dan) },
    )

    const res = await agent.api.app.bsky.graph.getListMutes(
      {},
      { headers: sc.getHeaders(dan) },
    )
    expect(res.data.lists.length).toBe(1)
  })

  it('updates list', async () => {
    const uri = new AtUri(listUri)
    await agent.api.com.atproto.repo.putRecord(
      {
        repo: uri.hostname,
        collection: uri.collection,
        rkey: uri.rkey,
        record: {
          name: 'updated alice mutes',
          purpose: 'app.bsky.graph.defs#modlist',
          description: 'new descript',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const got = await agent.api.app.bsky.graph.getList(
      { list: listUri },
      { headers: sc.getHeaders(alice) },
    )
    expect(got.data.list.name).toBe('updated alice mutes')
    expect(got.data.list.description).toBe('new descript')
    expect(got.data.list.avatar).toBeUndefined()
    expect(got.data.items.length).toBe(2)
  })

  it('embeds lists in posts', async () => {
    const postRef = await sc.post(
      alice,
      'list embed!',
      undefined,
      undefined,
      new RecordRef(listUri, listCid),
    )
    const res = await agent.api.app.bsky.feed.getPosts(
      { uris: [postRef.ref.uriStr] },
      { headers: sc.getHeaders(alice) },
    )
    expect(res.data.posts.length).toBe(1)
    expect(forSnapshot(res.data.posts[0])).toMatchSnapshot()
  })
})
