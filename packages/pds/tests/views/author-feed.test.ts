import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/moderationAction'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  paginateAll,
  adminAuth,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds author feed views', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_author_feed',
    })
    close = server.close
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc, server.ctx.messageQueue)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await close()
  })

  it('fetches full author feeds for self (sorted, minimal myState).', async () => {
    const aliceForAlice = await client.app.bsky.feed.getAuthorFeed(
      { author: sc.accounts[alice].handle },
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceForAlice.data.feed)).toMatchSnapshot()

    const bobForBob = await client.app.bsky.feed.getAuthorFeed(
      { author: sc.accounts[bob].handle },
      {
        headers: sc.getHeaders(bob),
      },
    )

    expect(forSnapshot(bobForBob.data.feed)).toMatchSnapshot()

    const carolForCarol = await client.app.bsky.feed.getAuthorFeed(
      { author: sc.accounts[carol].handle },
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolForCarol.data.feed)).toMatchSnapshot()

    const danForDan = await client.app.bsky.feed.getAuthorFeed(
      { author: sc.accounts[dan].handle },
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(forSnapshot(danForDan.data.feed)).toMatchSnapshot()
  })

  it("reflects fetching user's state in the feed.", async () => {
    const aliceForCarol = await client.app.bsky.feed.getAuthorFeed(
      { author: sc.accounts[alice].handle },
      {
        headers: sc.getHeaders(carol),
      },
    )

    aliceForCarol.data.feed.forEach((postView) => {
      const { viewer, uri } = postView.post
      expect(viewer?.upvote).toEqual(sc.votes.up[carol]?.[uri]?.toString())
      expect(viewer?.downvote).toEqual(sc.votes.down[carol]?.[uri]?.toString())
      expect(viewer?.repost).toEqual(sc.reposts[carol][uri]?.toString())
    })

    expect(forSnapshot(aliceForCarol.data.feed)).toMatchSnapshot()
  })

  it('fetches scene feeds with trends.', async () => {
    const sceneForCarol = await client.app.bsky.feed.getAuthorFeed(
      { author: sc.scenes['scene.test'].handle },
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(sceneForCarol.data.feed)).toMatchSnapshot()
  })

  it('omits reposts from muted users.', async () => {
    await client.app.bsky.graph.mute(
      { user: alice }, // Has a repost by dan: will be omitted from dan's feed
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    await client.app.bsky.graph.mute(
      { user: dan }, // Feed author: their posts will still appear
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    const bobForDan = await client.app.bsky.feed.getAuthorFeed(
      { author: sc.accounts[dan].handle },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(bobForDan.data.feed)).toMatchSnapshot()

    await client.app.bsky.graph.unmute(
      { user: alice },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    await client.app.bsky.graph.unmute(
      { user: dan },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.feed.getAuthorFeed(
        {
          author: sc.accounts[alice].handle,
          before: cursor,
          limit: 2,
        },
        { headers: sc.getHeaders(dan) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(2),
    )

    const full = await client.app.bsky.feed.getAuthorFeed(
      {
        author: sc.accounts[alice].handle,
      },
      { headers: sc.getHeaders(dan) },
    )

    expect(full.data.feed.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('blocked by actor takedown.', async () => {
    const { data: preBlock } = await client.app.bsky.feed.getAuthorFeed(
      { author: alice },
      { headers: sc.getHeaders(carol) },
    )

    expect(preBlock.feed.length).toBeGreaterThan(0)

    await client.com.atproto.admin.takeModerationAction(
      {
        action: TAKEDOWN,
        subject: {
          $type: 'com.atproto.admin.moderationAction#subjectRepo',
          did: alice,
        },
        createdBy: 'X',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )

    const { data: postBlock } = await client.app.bsky.feed.getAuthorFeed(
      { author: alice },
      { headers: sc.getHeaders(carol) },
    )

    expect(postBlock.feed.length).toEqual(0)
  })
})
