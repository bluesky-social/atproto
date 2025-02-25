import assert from 'node:assert'
import { AtUri, AtpAgent } from '@atproto/api'
import { RecordRef, SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { isView as isRecordEmbedView } from '../../src/lexicon/types/app/bsky/embed/record'
import { isPostView } from '../../src/lexicon/types/app/bsky/feed/defs'
import { assertIsThreadViewPost, forSnapshot } from '../_util'

describe('pds views with blocking', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let danBlockCarol: { uri: string }
  let aliceReplyToDan: { ref: RecordRef }
  let carolReplyToDan: { ref: RecordRef }

  let alice: string
  let bob: string
  let carol: string
  let dan: string
  let danBlockUri: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_block',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
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
    const _carolReplyToAliceReplyToDan = await sc.reply(
      carol,
      sc.posts[dan][0].ref,
      aliceReplyToDan.ref,
      "carol replies to alice's reply to dan",
    )
    carolReplyToDan = await sc.reply(
      carol,
      sc.posts[dan][0].ref,
      sc.posts[dan][0].ref,
      'carol replies to dan',
    )
    // dan blocks carol
    danBlockCarol = await pdsAgent.api.app.bsky.graph.block.create(
      { repo: dan },
      { createdAt: new Date().toISOString(), subject: carol },
      sc.getHeaders(dan),
    )
    danBlockUri = danBlockCarol.uri
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('blocks thread post', async () => {
    const { data: threadAlice } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[carol][0].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          dan,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    expect(threadAlice).toEqual({
      thread: {
        $type: 'app.bsky.feed.defs#blockedPost',
        uri: sc.posts[carol][0].ref.uriStr,
        blocked: true,
        author: {
          did: carol,
          viewer: {
            blockedBy: false,
            blocking: danBlockUri,
          },
        },
      },
    })
    const { data: threadCarol } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[dan][0].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    expect(threadCarol).toEqual({
      thread: {
        $type: 'app.bsky.feed.defs#blockedPost',
        uri: sc.posts[dan][0].ref.uriStr,
        blocked: true,
        author: {
          did: dan,
          viewer: {
            blockedBy: true,
          },
        },
      },
    })
  })

  it('blocks thread reply', async () => {
    // Contains reply by carol
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          dan,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('loads blocked reply as anchor with blocked parent', async () => {
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: carolReplyToDan.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )

    assertIsThreadViewPost(thread.thread)

    expect(thread.thread.post.uri).toEqual(carolReplyToDan.ref.uriStr)
    expect(thread.thread.parent).toMatchObject({
      $type: 'app.bsky.feed.defs#blockedPost',
      uri: sc.posts[dan][0].ref.uriStr,
    })
  })

  it('blocks thread parent', async () => {
    // Parent is a post by dan
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: aliceReplyToDan.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('blocks record embeds', async () => {
    // Contains a deep embed of carol's post, blocked by dan
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 0, uri: sc.posts[alice][2].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          dan,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('errors on getting author feed', async () => {
    const attempt1 = agent.api.app.bsky.feed.getAuthorFeed(
      { actor: carol },
      {
        headers: await network.serviceHeaders(
          dan,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )
    await expect(attempt1).rejects.toMatchObject({
      error: 'BlockedActor',
    })

    const attempt2 = agent.api.app.bsky.feed.getAuthorFeed(
      { actor: dan },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )
    await expect(attempt2).rejects.toMatchObject({
      error: 'BlockedByActor',
    })
  })

  it('strips blocked users out of getTimeline', async () => {
    const resCarol = await agent.api.app.bsky.feed.getTimeline(
      { limit: 100 },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )

    // dan's posts don't appear, nor alice's reply to dan, nor carol's reply to alice (which was a reply to dan)
    expect(
      resCarol.data.feed.some(
        (post) =>
          post.post.author.did === dan ||
          (isPostView(post.reply?.parent) &&
            post.reply.parent.author.did === dan) ||
          post.reply?.grandparentAuthor?.did === dan,
      ),
    ).toBeFalsy()

    const resDan = await agent.api.app.bsky.feed.getTimeline(
      { limit: 100 },
      {
        headers: await network.serviceHeaders(dan, ids.AppBskyFeedGetTimeline),
      },
    )
    expect(
      resDan.data.feed.some(
        (post) =>
          post.post.author.did === carol ||
          (isPostView(post.reply?.parent) &&
            post.reply.parent.author.did === carol) ||
          post.reply?.grandparentAuthor?.did === carol,
      ),
    ).toBeFalsy()
  })

  it('strips blocked users out of getListFeed', async () => {
    const listRef = await sc.createList(alice, 'test list', 'curate')
    await sc.addToList(alice, alice, listRef)
    await sc.addToList(alice, carol, listRef)
    await sc.addToList(alice, dan, listRef)

    const resCarol = await agent.api.app.bsky.feed.getListFeed(
      { list: listRef.uriStr, limit: 100 },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetListFeed,
        ),
      },
    )
    expect(
      resCarol.data.feed.some((post) => post.post.author.did === dan),
    ).toBeFalsy()

    const resDan = await agent.api.app.bsky.feed.getListFeed(
      { list: listRef.uriStr, limit: 100 },
      {
        headers: await network.serviceHeaders(dan, ids.AppBskyFeedGetListFeed),
      },
    )
    expect(
      resDan.data.feed.some((post) => post.post.author.did === carol),
    ).toBeFalsy()
  })

  it('returns block status on getProfile', async () => {
    const resCarol = await agent.api.app.bsky.actor.getProfile(
      { actor: dan },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyActorGetProfile,
        ),
      },
    )
    expect(resCarol.data.viewer?.blocking).toBeUndefined()
    expect(resCarol.data.viewer?.blockedBy).toBe(true)

    const resDan = await agent.api.app.bsky.actor.getProfile(
      { actor: carol },
      {
        headers: await network.serviceHeaders(dan, ids.AppBskyActorGetProfile),
      },
    )
    expect(resDan.data.viewer?.blocking).toBeDefined()
    expect(resDan.data.viewer?.blockedBy).toBe(false)
  })

  it('unsets viewer follow state when blocked', async () => {
    // there are follows between carol and dan
    const { data: profile } = await agent.api.app.bsky.actor.getProfile(
      { actor: carol },
      {
        headers: await network.serviceHeaders(dan, ids.AppBskyActorGetProfile),
      },
    )
    expect(profile.viewer?.following).toBeUndefined()
    expect(profile.viewer?.followedBy).toBeUndefined()
    const { data: result } = await agent.api.app.bsky.graph.getBlocks(
      {},
      { headers: await network.serviceHeaders(dan, ids.AppBskyGraphGetBlocks) },
    )
    const blocked = result.blocks.find((block) => block.did === carol)
    expect(blocked).toBeDefined()
    expect(blocked?.viewer?.following).toBeUndefined()
    expect(blocked?.viewer?.followedBy).toBeUndefined()
  })

  it('returns block status on getProfiles', async () => {
    const resCarol = await agent.api.app.bsky.actor.getProfiles(
      { actors: [alice, dan] },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyActorGetProfiles,
        ),
      },
    )
    expect(resCarol.data.profiles[0].viewer?.blocking).toBeUndefined()
    expect(resCarol.data.profiles[0].viewer?.blockingByList).toBeUndefined()
    expect(resCarol.data.profiles[0].viewer?.blockedBy).toBe(false)
    expect(resCarol.data.profiles[1].viewer?.blocking).toBeUndefined()
    expect(resCarol.data.profiles[1].viewer?.blockingByList).toBeUndefined()
    expect(resCarol.data.profiles[1].viewer?.blockedBy).toBe(true)

    const resDan = await agent.api.app.bsky.actor.getProfiles(
      { actors: [alice, carol] },
      {
        headers: await network.serviceHeaders(dan, ids.AppBskyActorGetProfiles),
      },
    )
    expect(resDan.data.profiles[0].viewer?.blocking).toBeUndefined()
    expect(resDan.data.profiles[0].viewer?.blockingByList).toBeUndefined()
    expect(resDan.data.profiles[0].viewer?.blockedBy).toBe(false)
    expect(resDan.data.profiles[1].viewer?.blocking).toBeDefined()
    expect(resDan.data.profiles[1].viewer?.blockingByList).toBeUndefined()
    expect(resDan.data.profiles[1].viewer?.blockedBy).toBe(false)
  })

  it('does not return block violating follows', async () => {
    const resCarol = await agent.api.app.bsky.graph.getFollows(
      { actor: carol },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollows,
        ),
      },
    )
    expect(resCarol.data.follows.some((f) => f.did === dan)).toBe(false)

    const resDan = await agent.api.app.bsky.graph.getFollows(
      { actor: dan },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollows,
        ),
      },
    )
    expect(resDan.data.follows.some((f) => f.did === carol)).toBe(false)
  })

  it('does not return block violating followers', async () => {
    const resCarol = await agent.api.app.bsky.graph.getFollowers(
      { actor: carol },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollowers,
        ),
      },
    )
    expect(resCarol.data.followers.some((f) => f.did === dan)).toBe(false)

    const resDan = await agent.api.app.bsky.graph.getFollowers(
      { actor: dan },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollowers,
        ),
      },
    )
    expect(resDan.data.followers.some((f) => f.did === carol)).toBe(false)
  })

  it('does not return posts from blocked users', async () => {
    const alicePost = sc.posts[alice][0].ref.uriStr
    const carolPost = sc.posts[carol][0].ref.uriStr
    const danPost = sc.posts[dan][0].ref.uriStr

    const resCarol = await agent.api.app.bsky.feed.getPosts(
      { uris: [alicePost, carolPost, danPost] },
      { headers: await network.serviceHeaders(carol, ids.AppBskyFeedGetPosts) },
    )
    expect(resCarol.data.posts.some((p) => p.uri === alicePost)).toBe(true)
    expect(resCarol.data.posts.some((p) => p.uri === carolPost)).toBe(true)
    expect(resCarol.data.posts.some((p) => p.uri === danPost)).toBe(false)

    const resDan = await agent.api.app.bsky.feed.getPosts(
      { uris: [alicePost, carolPost, danPost] },
      { headers: await network.serviceHeaders(dan, ids.AppBskyFeedGetPosts) },
    )
    expect(resDan.data.posts.some((p) => p.uri === alicePost)).toBe(true)
    expect(resDan.data.posts.some((p) => p.uri === carolPost)).toBe(false)
    expect(resDan.data.posts.some((p) => p.uri === danPost)).toBe(true)
  })

  it('does not return notifs for blocked accounts', async () => {
    const resCarol = await agent.api.app.bsky.notification.listNotifications(
      {
        limit: 100,
      },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(
      resCarol.data.notifications.some((notif) => notif.author.did === dan),
    ).toBeFalsy()

    const resDan = await agent.api.app.bsky.notification.listNotifications(
      {
        limit: 100,
      },
      {
        headers: await network.serviceHeaders(
          dan,
          ids.AppBskyNotificationListNotifications,
        ),
      },
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
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyActorSearchActors,
        ),
      },
    )
    expect(resCarol.data.actors.some((actor) => actor.did === dan)).toBeFalsy()

    const resDan = await agent.api.app.bsky.actor.searchActors(
      {
        term: 'carol.test',
      },
      {
        headers: await network.serviceHeaders(
          dan,
          ids.AppBskyActorSearchActors,
        ),
      },
    )
    expect(resDan.data.actors.some((actor) => actor.did === carol)).toBeFalsy()
  })

  it('does not return blocked accounts in actor search typeahead', async () => {
    const resCarol = await agent.api.app.bsky.actor.searchActorsTypeahead(
      {
        term: 'dan.tes',
      },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyActorSearchActorsTypeahead,
        ),
      },
    )
    expect(resCarol.data.actors.some((actor) => actor.did === dan)).toBeFalsy()

    const resDan = await agent.api.app.bsky.actor.searchActorsTypeahead(
      {
        term: 'carol.tes',
      },
      {
        headers: await network.serviceHeaders(
          dan,
          ids.AppBskyActorSearchActorsTypeahead,
        ),
      },
    )
    expect(resDan.data.actors.some((actor) => actor.did === carol)).toBeFalsy()
  })

  it('does return blocked accounts in actor search typeahead when term is exact handle', async () => {
    const resCarol = await agent.api.app.bsky.actor.searchActorsTypeahead(
      {
        term: 'dan.test',
      },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyActorSearchActorsTypeahead,
        ),
      },
    )
    expect(resCarol.data.actors.some((actor) => actor.did === dan)).toBeTruthy()

    const resDan = await agent.api.app.bsky.actor.searchActorsTypeahead(
      {
        term: 'carol.test',
      },
      {
        headers: await network.serviceHeaders(
          dan,
          ids.AppBskyActorSearchActorsTypeahead,
        ),
      },
    )
    expect(resDan.data.actors.some((actor) => actor.did === carol)).toBeTruthy()
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
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyActorGetSuggestions,
        ),
      },
    )
    expect(resCarol.data.actors.some((actor) => actor.did === dan)).toBeFalsy()

    const resDan = await agent.api.app.bsky.actor.getSuggestions(
      {
        limit: 100,
      },
      {
        headers: await network.serviceHeaders(
          dan,
          ids.AppBskyActorGetSuggestions,
        ),
      },
    )
    expect(resDan.data.actors.some((actor) => actor.did === carol)).toBeFalsy()
  })

  it('does not serve blocked replies', async () => {
    const getThreadPostUri = (r) => r?.['post']?.['uri']
    // reply then block
    const { data: replyThenBlock } =
      await agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.posts[dan][0].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
    assertIsThreadViewPost(replyThenBlock.thread)

    expect(replyThenBlock.thread.replies?.map(getThreadPostUri)).toEqual([
      aliceReplyToDan.ref.uriStr,
    ])

    // unblock
    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: dan, rkey: new AtUri(danBlockCarol.uri).rkey },
      sc.getHeaders(dan),
    )
    await network.processAll()
    const { data: unblock } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[dan][0].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )

    assertIsThreadViewPost(unblock.thread)
    expect(unblock.thread.replies?.map(getThreadPostUri)).toEqual([
      carolReplyToDan.ref.uriStr,
      aliceReplyToDan.ref.uriStr,
    ])

    // block then reply
    danBlockCarol = await pdsAgent.api.app.bsky.graph.block.create(
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
    await network.processAll()
    const { data: blockThenReply } =
      await agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.posts[dan][0].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

    assertIsThreadViewPost(blockThenReply.thread)

    expect(replyThenBlock.thread.replies?.map(getThreadPostUri)).toEqual([
      aliceReplyToDan.ref.uriStr,
    ])

    // cleanup
    await pdsAgent.api.app.bsky.feed.post.delete(
      { repo: carol, rkey: carolReplyToDan2.ref.uri.rkey },
      sc.getHeaders(carol),
    )
    await network.processAll()
  })

  it('does not serve blocked embeds to third-party', async () => {
    // embed then block
    const { data: embedThenBlock } =
      await agent.api.app.bsky.feed.getPostThread(
        { depth: 0, uri: sc.posts[dan][1].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

    assertIsThreadViewPost(embedThenBlock.thread)

    assert(isRecordEmbedView(embedThenBlock.thread.post.embed))
    expect(embedThenBlock.thread.post.embed.record).toMatchObject({
      $type: 'app.bsky.embed.record#viewBlocked',
    })

    // unblock
    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: dan, rkey: new AtUri(danBlockCarol.uri).rkey },
      sc.getHeaders(dan),
    )
    await network.processAll()
    const { data: unblock } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 0, uri: sc.posts[dan][1].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )

    assertIsThreadViewPost(unblock.thread)

    assert(isRecordEmbedView(unblock.thread.post?.embed))
    expect(unblock.thread.post?.embed.record).toMatchObject({
      $type: 'app.bsky.embed.record#viewRecord',
    })

    // block then embed
    danBlockCarol = await pdsAgent.api.app.bsky.graph.block.create(
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
    await network.processAll()
    const { data: blockThenEmbed } =
      await agent.api.app.bsky.feed.getPostThread(
        { depth: 0, uri: carolEmbedsDan.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
    assertIsThreadViewPost(blockThenEmbed.thread)
    assert(isRecordEmbedView(blockThenEmbed.thread.post.embed))
    expect(blockThenEmbed.thread.post.embed.record).toMatchObject({
      $type: 'app.bsky.embed.record#viewBlocked',
    })

    // cleanup
    await pdsAgent.api.app.bsky.feed.post.delete(
      { repo: carol, rkey: carolEmbedsDan.ref.uri.rkey },
      sc.getHeaders(carol),
    )
    await network.processAll()
  })

  it('applies third-party blocking rules in feeds.', async () => {
    // alice follows carol and dan, block exists between carol and dan.
    const replyBlockedUri = carolReplyToDan.ref.uriStr
    const replyBlockedParentUri = sc.posts[dan][0].ref.uriStr
    const embedBlockedUri = sc.posts[dan][1].ref.uriStr
    const { data: timeline } = await agent.api.app.bsky.feed.getTimeline(
      { limit: 100 },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )
    const replyBlockedPost = timeline.feed.find(
      (item) => item.post.uri === replyBlockedUri,
    )
    expect(replyBlockedPost?.reply).toMatchObject({
      root: {
        $type: 'app.bsky.feed.defs#blockedPost',
        uri: replyBlockedParentUri,
      },
      parent: {
        $type: 'app.bsky.feed.defs#blockedPost',
        uri: replyBlockedParentUri,
      },
    })
    const embedBlockedPost = timeline.feed.find(
      (item) => item.post.uri === embedBlockedUri,
    )
    assert(embedBlockedPost)
    assert(isRecordEmbedView(embedBlockedPost.post.embed))
    expect(embedBlockedPost.post.embed.record).toMatchObject({
      $type: 'app.bsky.embed.record#viewBlocked',
    })
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
      { headers: await network.serviceHeaders(dan, ids.AppBskyGraphGetBlocks) },
    )
    const dids = res.data.blocks.map((block) => block.did).sort()
    expect(dids).toEqual([alice, carol].sort())
  })

  it('paginates getBlocks', async () => {
    const full = await agent.api.app.bsky.graph.getBlocks(
      {},
      { headers: await network.serviceHeaders(dan, ids.AppBskyGraphGetBlocks) },
    )
    const first = await agent.api.app.bsky.graph.getBlocks(
      { limit: 1 },
      { headers: await network.serviceHeaders(dan, ids.AppBskyGraphGetBlocks) },
    )
    const second = await agent.api.app.bsky.graph.getBlocks(
      { cursor: first.data.cursor },
      { headers: await network.serviceHeaders(dan, ids.AppBskyGraphGetBlocks) },
    )
    const combined = [...first.data.blocks, ...second.data.blocks]
    expect(combined).toEqual(full.data.blocks)
  })

  it('returns knownFollowers with blocks filtered', async () => {
    const carolForAlice = await agent.api.app.bsky.actor.getProfile(
      { actor: bob },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyActorGetProfile,
        ),
      },
    )

    const knownFollowers = carolForAlice.data.viewer?.knownFollowers
    expect(knownFollowers?.count).toBe(1)
    expect(knownFollowers?.followers).toHaveLength(0)
  })
})
