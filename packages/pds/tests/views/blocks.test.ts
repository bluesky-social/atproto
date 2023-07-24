import assert from 'assert'
import AtpAgent, { AtUri } from '@atproto/api'
import { RecordRef } from '@atproto/bsky/tests/seeds/client'
import { BlockedActorError } from '@atproto/api/src/client/types/app/bsky/feed/getAuthorFeed'
import { BlockedByActorError } from '@atproto/api/src/client/types/app/bsky/feed/getAuthorFeed'
import { isThreadViewPost } from '@atproto/api/src/client/types/app/bsky/feed/defs'
import {
  isViewRecord as isEmbedViewRecord,
  isViewBlocked as isEmbedViewBlocked,
} from '@atproto/api/src/client/types/app/bsky/embed/record'
import { runTestServer, CloseFn, TestServerInfo, forSnapshot } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds views with blocking', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient
  let danBlockCarol: { uri: string }
  let aliceReplyToDan: { ref: RecordRef }
  let carolReplyToDan: { ref: RecordRef }

  let alice: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'views_block',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
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
    carolReplyToDan = await sc.reply(
      carol,
      sc.posts[dan][0].ref,
      sc.posts[dan][0].ref,
      'carol replies to dan',
    )
    // dan blocks carol
    danBlockCarol = await agent.api.app.bsky.graph.block.create(
      { repo: dan },
      { createdAt: new Date().toISOString(), subject: carol },
      sc.getHeaders(dan),
    )
    await server.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it('blocks thread post', async () => {
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
    const resCarol = await agent.api.app.bsky.feed.getTimeline(
      { limit: 100 },
      { headers: sc.getHeaders(carol) },
    )
    expect(
      resCarol.data.feed.some((post) => post.post.author.did === dan),
    ).toBeFalsy()

    const resDan = await agent.api.app.bsky.feed.getTimeline(
      { limit: 100 },
      { headers: sc.getHeaders(dan) },
    )
    expect(
      resDan.data.feed.some((post) => post.post.author.did === carol),
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
      resDan.data.feed.some((post) => post.post.author.did === carol),
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
      { headers: sc.getHeaders(dan) },
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

  it('does not serve blocked replies', async () => {
    const getThreadPostUri = (r) => r?.['post']?.['uri']
    // reply then block
    const { data: replyThenBlock } =
      await agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.posts[dan][0].ref.uriStr },
        { headers: sc.getHeaders(alice) },
      )
    assert(isThreadViewPost(replyThenBlock.thread))
    expect(replyThenBlock.thread.replies?.map(getThreadPostUri)).toEqual([
      aliceReplyToDan.ref.uriStr,
    ])

    // unblock
    await agent.api.app.bsky.graph.block.delete(
      { repo: dan, rkey: new AtUri(danBlockCarol.uri).rkey },
      sc.getHeaders(dan),
    )
    const { data: unblock } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[dan][0].ref.uriStr },
      { headers: sc.getHeaders(alice) },
    )
    assert(isThreadViewPost(unblock.thread))
    expect(unblock.thread.replies?.map(getThreadPostUri)).toEqual([
      carolReplyToDan.ref.uriStr,
      aliceReplyToDan.ref.uriStr,
    ])

    // block then reply
    danBlockCarol = await agent.api.app.bsky.graph.block.create(
      { repo: dan },
      { createdAt: new Date().toISOString(), subject: carol },
      sc.getHeaders(dan),
    )
    const carolReplyToDan2 = await sc.reply(
      carol,
      sc.posts[dan][1].ref,
      sc.posts[dan][1].ref,
      'carol replies to dan again',
    )
    const { data: blockThenReply } =
      await agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.posts[dan][0].ref.uriStr },
        { headers: sc.getHeaders(alice) },
      )
    assert(isThreadViewPost(blockThenReply.thread))
    expect(replyThenBlock.thread.replies?.map(getThreadPostUri)).toEqual([
      aliceReplyToDan.ref.uriStr,
    ])

    // cleanup
    await agent.api.app.bsky.feed.post.delete(
      { repo: carol, rkey: carolReplyToDan2.ref.uri.rkey },
      sc.getHeaders(carol),
    )
  })

  it('does not serve blocked embeds to third-party', async () => {
    // embed then block
    const { data: embedThenBlock } =
      await agent.api.app.bsky.feed.getPostThread(
        { depth: 0, uri: sc.posts[dan][1].ref.uriStr },
        { headers: sc.getHeaders(alice) },
      )
    assert(isThreadViewPost(embedThenBlock.thread))
    assert(isEmbedViewBlocked(embedThenBlock.thread.post.embed?.record))

    // unblock
    await agent.api.app.bsky.graph.block.delete(
      { repo: dan, rkey: new AtUri(danBlockCarol.uri).rkey },
      sc.getHeaders(dan),
    )
    const { data: unblock } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 0, uri: sc.posts[dan][1].ref.uriStr },
      { headers: sc.getHeaders(alice) },
    )
    assert(isThreadViewPost(unblock.thread))
    assert(isEmbedViewRecord(unblock.thread.post.embed?.record))

    // block then embed
    danBlockCarol = await agent.api.app.bsky.graph.block.create(
      { repo: dan },
      { createdAt: new Date().toISOString(), subject: carol },
      sc.getHeaders(dan),
    )
    const carolEmbedsDan = await sc.post(
      carol,
      'carol embeds dan',
      undefined,
      undefined,
      sc.posts[dan][0].ref,
    )
    const { data: blockThenEmbed } =
      await agent.api.app.bsky.feed.getPostThread(
        { depth: 0, uri: carolEmbedsDan.ref.uriStr },
        { headers: sc.getHeaders(alice) },
      )
    assert(isThreadViewPost(blockThenEmbed.thread))
    assert(isEmbedViewBlocked(blockThenEmbed.thread.post.embed?.record))

    // cleanup
    await agent.api.app.bsky.feed.post.delete(
      { repo: carol, rkey: carolEmbedsDan.ref.uri.rkey },
      sc.getHeaders(carol),
    )
  })

  it('applies third-party blocking rules in feeds.', async () => {
    // alice follows carol and dan, block exists between carol and dan.
    const replyBlockedUri = carolReplyToDan.ref.uriStr
    const embedBlockedUri = sc.posts[dan][1].ref.uriStr
    const { data: timeline } = await agent.api.app.bsky.feed.getTimeline(
      { limit: 100 },
      { headers: sc.getHeaders(alice) },
    )
    const replyBlockedPost = timeline.feed.find(
      (item) => item.post.uri === replyBlockedUri,
    )
    expect(replyBlockedPost).toBeUndefined()
    const embedBlockedPost = timeline.feed.find(
      (item) => item.post.uri === embedBlockedUri,
    )
    assert(embedBlockedPost)
    assert(isEmbedViewBlocked(embedBlockedPost.post.embed?.record))
  })

  it('returns a list of blocks', async () => {
    await agent.api.app.bsky.graph.block.create(
      { repo: dan },
      { createdAt: new Date().toISOString(), subject: alice },
      sc.getHeaders(dan),
    )

    const res = await agent.api.app.bsky.graph.getBlocks(
      {},
      { headers: sc.getHeaders(dan) },
    )
    const dids = res.data.blocks.map((block) => block.did).sort()
    expect(dids).toEqual([alice, carol].sort())
  })

  it('paginates getBlocks', async () => {
    const full = await agent.api.app.bsky.graph.getBlocks(
      {},
      { headers: sc.getHeaders(dan) },
    )
    const first = await agent.api.app.bsky.graph.getBlocks(
      { limit: 1 },
      { headers: sc.getHeaders(dan) },
    )
    const second = await agent.api.app.bsky.graph.getBlocks(
      { cursor: first.data.cursor },
      { headers: sc.getHeaders(dan) },
    )
    const combined = [...first.data.blocks, ...second.data.blocks]
    expect(combined).toEqual(full.data.blocks)
  })
})
