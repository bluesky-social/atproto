import { AtpAgent } from '@atproto/api'
import {
  SeedClient,
  TestNetwork,
  basicSeed,
  usersBulkSeed,
} from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { OutputSchema as GetMutesOutputSchema } from '../../src/lexicon/types/app/bsky/graph/getMutes'
import { forSnapshot, paginateAll } from '../_util'

describe('mute views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  let mutes: string[]

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_mutes',
    })
    agent = network.bsky.getClient()
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

  afterAll(async () => {
    await network.close()
  })

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
      res.data.feed.some((post) => [bob, carol].includes(post.post.author.did)),
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
      res.data.feed.some((post) => [bob, carol].includes(post.post.author.did)),
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
      res.data.feed.some((post) => [bob, carol].includes(post.post.author.did)),
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
        [bob, carol].includes(notif.author.did),
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
      if (mutes.includes(actor.did) || mutes.includes(actor.handle)) {
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

  it('paginates.', async () => {
    const results = (results: GetMutesOutputSchema[]) =>
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
    paginatedAll.forEach((res) =>
      expect(res.mutes.length).toBeLessThanOrEqual(2),
    )

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
