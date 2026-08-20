import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  AppBskyFeedDefs,
  type AppBskyGraphGetMutes,
  type AtpAgent,
  ids,
} from '@atproto/api'
import {
  type SeedClient,
  TestNetwork,
  basicSeed,
  usersBulkSeed,
} from '@atproto/dev-env'
import type {
  AtIdentifierString,
  DidString,
  HandleString,
} from '@atproto/syntax'
import { forSnapshot, getOriginator, paginateAll } from '../_util.js'

describe('mute views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let alice: DidString
  let bob: DidString
  let carol: DidString
  let dan: DidString

  let mutes: AtIdentifierString[]

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_mutes',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await usersBulkSeed(sc, 10)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    mutes = [
      bob,
      carol,
      'aliya-hodkiewicz.test',
      'adrienne49.test',
      'jeffrey-sawayn87.test',
      'nicolas-krajcik10.test',
      'magnus53.test',
      'elta48.test',
    ]
    await network.processAll()
    for (const did of mutes) {
      await agent.api.app.bsky.graph.muteActor(
        { actor: did },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphMuteActor,
          ),
          encoding: 'application/json',
        },
      )
    }
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  it('flags mutes in threads', async () => {
    const res = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    expect(forSnapshot(res.data.thread)).toMatchSnapshot()
  })

  it('does not show reposted content from a muted account in author feed', async () => {
    await sc.repost(dan, sc.posts[bob][0].ref)
    await sc.repost(dan, sc.posts[bob][1].ref)
    await network.processAll()

    const res = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: dan },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )
    expect(
      res.data.feed.some((post) =>
        [bob, carol].includes(post.post.author.did as DidString),
      ),
    ).toBe(false)
  })

  it('removes content from muted users on getTimeline', async () => {
    const res = await agent.api.app.bsky.feed.getTimeline(
      { limit: 100 },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )
    expect(
      res.data.feed.some((post) =>
        [bob, carol].includes(post.post.author.did as DidString),
      ),
    ).toBe(false)
  })

  it('removes content from muted users on getListFeed', async () => {
    const listRef = await sc.createList(bob, 'test list', 'curate')
    await sc.addToList(alice, bob, listRef)
    await sc.addToList(alice, carol, listRef)
    await sc.addToList(alice, dan, listRef)
    const res = await agent.api.app.bsky.feed.getListFeed(
      { list: listRef.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetListFeed,
        ),
      },
    )
    expect(
      res.data.feed.some((post) =>
        [bob, carol].includes(post.post.author.did as DidString),
      ),
    ).toBe(false)
  })

  it('returns mute status on getProfile', async () => {
    const res = await agent.api.app.bsky.actor.getProfile(
      { actor: bob },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyActorGetProfile,
        ),
      },
    )
    expect(res.data.viewer?.muted).toBe(true)
  })

  it('supports muting only reposts from an account', async () => {
    let cleanedUp = false
    await agent.api.app.bsky.graph.muteActor(
      { actor: dan, onlyReposts: true },
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyGraphMuteActor),
        encoding: 'application/json',
      },
    )

    try {
      const authoredPost = await sc.post(
        dan,
        'dan post visible through repost mute',
      )
      await sc.repost(dan, sc.posts[alice][0].ref)
      const listRef = await sc.createList(alice, 'repost mute test', 'curate')
      await sc.addToList(alice, dan, listRef)
      await network.processAll()

      await agent.api.app.bsky.graph.muteActor(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphMuteActor,
          ),
          encoding: 'application/json',
        },
      )
      await network.processAll()
      const replacedWithFull = await agent.api.app.bsky.actor.getProfile(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      expect(replacedWithFull.data.viewer?.muted).toBe(true)
      expect(replacedWithFull.data.viewer?.mutedOnlyReposts).toBe(false)

      await agent.api.app.bsky.graph.muteActor(
        { actor: dan, onlyReposts: true },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphMuteActor,
          ),
          encoding: 'application/json',
        },
      )
      await network.processAll()
      const profile = await agent.api.app.bsky.actor.getProfile(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      expect(profile.data.viewer?.muted).toBe(false)
      expect(profile.data.viewer?.mutedOnlyReposts).toBe(true)

      // getMutes enumerates only fully muted accounts; the scoped mute on
      // dan is not included.
      const { data: mutes } = await agent.api.app.bsky.graph.getMutes(
        {},
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphGetMutes,
          ),
        },
      )
      expect(mutes.mutes.some((mute) => mute.did === dan)).toBe(false)

      // pages are filled server-side: dan's scoped mute is the most recent
      // and occupies the head of the first underlying page, but the page
      // still comes back with at least `limit` full mutes.
      const { data: page } = await agent.api.app.bsky.graph.getMutes(
        { limit: 2 },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphGetMutes,
          ),
        },
      )
      expect(page.mutes).toHaveLength(2)
      expect(page.mutes.some((mute) => mute.did === dan)).toBe(false)
      expect(page.cursor).toBeDefined()

      const { data: terminalPage } = await agent.api.app.bsky.graph.getMutes(
        { limit: 8 },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphGetMutes,
          ),
        },
      )
      expect(terminalPage.mutes).toHaveLength(8)
      expect(terminalPage.mutes.some((mute) => mute.did === dan)).toBe(false)
      expect(terminalPage.cursor).toBeUndefined()

      const timeline = await agent.api.app.bsky.feed.getTimeline(
        { limit: 100 },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetTimeline,
          ),
        },
      )
      expect(
        timeline.data.feed.some(
          (item) => item.post.uri === authoredPost.ref.uriStr,
        ),
      ).toBe(true)
      expect(timeline.data.feed.some((item) => isRepostBy(item, dan))).toBe(
        false,
      )

      const listFeed = await agent.api.app.bsky.feed.getListFeed(
        { list: listRef.uriStr },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetListFeed,
          ),
        },
      )
      expect(
        listFeed.data.feed.some(
          (item) => item.post.uri === authoredPost.ref.uriStr,
        ),
      ).toBe(true)
      expect(listFeed.data.feed.some((item) => isRepostBy(item, dan))).toBe(
        false,
      )

      const authorFeed = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      )
      expect(
        authorFeed.data.feed.some(
          (item) => item.post.uri === authoredPost.ref.uriStr,
        ),
      ).toBe(true)
      expect(
        authorFeed.data.feed.some(
          (item) =>
            item.post.uri === sc.posts[alice][0].ref.uriStr &&
            isRepostBy(item, dan),
        ),
      ).toBe(true)

      await agent.api.app.bsky.graph.unmuteActor(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphUnmuteActor,
          ),
          encoding: 'application/json',
        },
      )
      await network.processAll()
      cleanedUp = true
      const unmutedProfile = await agent.api.app.bsky.actor.getProfile(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      expect(unmutedProfile.data.viewer?.muted).toBe(false)
      expect(unmutedProfile.data.viewer?.mutedOnlyReposts).toBe(false)
    } finally {
      if (!cleanedUp) {
        await agent.api.app.bsky.graph.unmuteActor(
          { actor: dan },
          {
            headers: await network.serviceHeaders(
              alice,
              ids.AppBskyGraphUnmuteActor,
            ),
            encoding: 'application/json',
          },
        )
        await network.processAll()
      }
    }
  })

  it('supports muting only quote posts from an account', async () => {
    await agent.api.app.bsky.graph.muteActor(
      { actor: dan, onlyQuoteposts: true },
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyGraphMuteActor),
        encoding: 'application/json',
      },
    )

    try {
      const plainPost = await sc.post(
        dan,
        'dan post visible through quotepost mute',
      )
      const quotePost = await sc.post(
        dan,
        'dan quote post hidden by quotepost mute',
        undefined,
        undefined,
        sc.posts[alice][0].ref,
      )
      const listRef = await sc.createList(alice, 'quote mute test', 'curate')
      await sc.addToList(alice, dan, listRef)
      await network.processAll()

      const profile = await agent.api.app.bsky.actor.getProfile(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      expect(profile.data.viewer?.muted).toBe(false)
      expect(profile.data.viewer?.mutedOnlyReposts).toBe(false)
      expect(profile.data.viewer?.mutedOnlyQuoteposts).toBe(true)

      const timeline = await agent.api.app.bsky.feed.getTimeline(
        { limit: 100 },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetTimeline,
          ),
        },
      )
      expect(
        timeline.data.feed.some(
          (item) => item.post.uri === plainPost.ref.uriStr,
        ),
      ).toBe(true)
      expect(
        timeline.data.feed.some(
          (item) => item.post.uri === quotePost.ref.uriStr,
        ),
      ).toBe(false)

      const listFeed = await agent.api.app.bsky.feed.getListFeed(
        { list: listRef.uriStr },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetListFeed,
          ),
        },
      )
      expect(
        listFeed.data.feed.some(
          (item) => item.post.uri === plainPost.ref.uriStr,
        ),
      ).toBe(true)
      expect(
        listFeed.data.feed.some(
          (item) => item.post.uri === quotePost.ref.uriStr,
        ),
      ).toBe(false)

      // author feed is unaffected by quotepost mutes
      const authorFeed = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      )
      expect(
        authorFeed.data.feed.some(
          (item) => item.post.uri === quotePost.ref.uriStr,
        ),
      ).toBe(true)
    } finally {
      await agent.api.app.bsky.graph.unmuteActor(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphUnmuteActor,
          ),
          encoding: 'application/json',
        },
      )
      await network.processAll()
    }
  })

  it('suppresses scoped mute flags when a mutelist fully mutes the account', async () => {
    // a scoped direct mute overlapping a mutelist mute must not surface
    // both muted and a mutedOnly* flag: the scoped flags are exclusive
    // with muted, which wins.
    await agent.api.app.bsky.graph.muteActor(
      { actor: dan, onlyReposts: true },
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyGraphMuteActor),
        encoding: 'application/json',
      },
    )
    const listRef = await sc.createList(alice, 'exclusivity test', 'mod')
    await sc.addToList(alice, dan, listRef)
    await network.processAll()
    await agent.api.app.bsky.graph.muteActorList(
      { list: listRef.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphMuteActorList,
        ),
        encoding: 'application/json',
      },
    )
    await network.processAll()

    try {
      const profile = await agent.api.app.bsky.actor.getProfile(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      expect(profile.data.viewer?.muted).toBe(true)
      expect(profile.data.viewer?.mutedByList?.uri).toBe(listRef.uriStr)
      expect(profile.data.viewer?.mutedOnlyReposts).toBe(false)
      expect(profile.data.viewer?.mutedOnlyQuoteposts).toBe(false)

      // removing the list mute resurfaces the scoped direct mute
      await agent.api.app.bsky.graph.unmuteActorList(
        { list: listRef.uriStr },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphUnmuteActorList,
          ),
          encoding: 'application/json',
        },
      )
      await network.processAll()
      const unlisted = await agent.api.app.bsky.actor.getProfile(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      expect(unlisted.data.viewer?.muted).toBe(false)
      expect(unlisted.data.viewer?.mutedOnlyReposts).toBe(true)
    } finally {
      await agent.api.app.bsky.graph.unmuteActorList(
        { list: listRef.uriStr },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphUnmuteActorList,
          ),
          encoding: 'application/json',
        },
      )
      await agent.api.app.bsky.graph.unmuteActor(
        { actor: dan },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphUnmuteActor,
          ),
          encoding: 'application/json',
        },
      )
      await network.processAll()
    }
  })

  it('returns mute status on getProfiles', async () => {
    const res = await agent.api.app.bsky.actor.getProfiles(
      { actors: [bob, carol, dan] },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyActorGetProfiles,
        ),
      },
    )
    expect(res.data.profiles[0].viewer?.muted).toBe(true)
    expect(res.data.profiles[1].viewer?.muted).toBe(true)
    expect(res.data.profiles[2].viewer?.muted).toBe(false)
  })

  it('does not return notifs for muted accounts', async () => {
    const res = await agent.api.app.bsky.notification.listNotifications(
      {
        limit: 100,
      },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(
      res.data.notifications.some((notif) =>
        [bob, carol].includes(notif.author.did as DidString),
      ),
    ).toBeFalsy()
  })

  it('flags muted accounts in get suggestions', async () => {
    // unfollow so they _would_ show up in suggestions if not for mute
    await sc.unfollow(alice, bob)
    await sc.unfollow(alice, carol)

    await network.processAll()

    const res = await agent.api.app.bsky.actor.getSuggestions(
      {
        limit: 100,
      },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyActorGetSuggestions,
        ),
      },
    )
    for (const actor of res.data.actors) {
      if (
        mutes.includes(actor.did as DidString) ||
        mutes.includes(actor.handle as HandleString)
      ) {
        expect(actor.viewer?.muted).toBe(true)
      } else {
        expect(actor.viewer?.muted).toBe(false)
      }
    }
  })

  it('fetches mutes for the logged-in user.', async () => {
    const { data: view } = await agent.api.app.bsky.graph.getMutes(
      {},
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyGraphGetMutes),
      },
    )
    expect(forSnapshot(view.mutes)).toMatchSnapshot()
  })

  it('getMutes only returns a dataplane cursor when another raw row exists', async () => {
    const exact = await network.bsky.ctx.dataplane.getMutes({
      actorDid: alice,
      limit: 8,
    })
    const nonterminal = await network.bsky.ctx.dataplane.getMutes({
      actorDid: alice,
      limit: 2,
    })
    expect(exact.mutes).toHaveLength(8)
    expect(exact.cursor).toBe('')
    expect(nonterminal.mutes).toHaveLength(2)
    expect(nonterminal.cursor).not.toBe('')
  })

  it('paginates.', async () => {
    const results = (results: AppBskyGraphGetMutes.OutputSchema[]) =>
      results.flatMap((res) => res.mutes)
    const paginator = async (cursor?: string) => {
      const { data: view } = await agent.api.app.bsky.graph.getMutes(
        { cursor, limit: 2 },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphGetMutes,
          ),
        },
      )
      return view
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) => expect(res.mutes).toHaveLength(2))
    paginatedAll.slice(0, -1).forEach((res) => expect(res.cursor).toBeDefined())
    expect(paginatedAll.at(-1)?.cursor).toBeUndefined()

    const full = await agent.api.app.bsky.graph.getMutes(
      {},
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyGraphGetMutes),
      },
    )

    expect(full.data.mutes.length).toEqual(8)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('removes mute.', async () => {
    const { data: initial } = await agent.api.app.bsky.graph.getMutes(
      {},
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyGraphGetMutes),
      },
    )
    expect(initial.mutes.length).toEqual(8)
    expect(initial.mutes.map((m) => m.handle)).toContain('elta48.test')

    await agent.api.app.bsky.graph.unmuteActor(
      { actor: sc.dids['elta48.test'] },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphUnmuteActor,
        ),
        encoding: 'application/json',
      },
    )
    await network.processAll()

    const { data: final } = await agent.api.app.bsky.graph.getMutes(
      {},
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyGraphGetMutes),
      },
    )
    expect(final.mutes.length).toEqual(7)
    expect(final.mutes.map((m) => m.handle)).not.toContain('elta48.test')

    await agent.api.app.bsky.graph.muteActor(
      { actor: sc.dids['elta48.test'] },
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyGraphMuteActor),
        encoding: 'application/json',
      },
    )
  })

  it('does not allow muting self.', async () => {
    const promise = agent.api.app.bsky.graph.muteActor(
      { actor: alice },
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyGraphMuteActor),
        encoding: 'application/json',
      },
    )
    await expect(promise).rejects.toThrow() // @TODO check error message w/ grpc error passthru
  })
})

const isRepostBy = (
  item: AppBskyFeedDefs.FeedViewPost,
  did: string,
): boolean => {
  return (
    AppBskyFeedDefs.isReasonRepost(item.reason) && getOriginator(item) === did
  )
}
