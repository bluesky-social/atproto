import AtpAgent, { ComAtprotoAdminTakeModerationAction } from '@atproto/api'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
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
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  const reverseModerationAction = async (id) =>
    agent.api.com.atproto.admin.reverseModerationAction(
      {
        id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )

  const takedownSubject = async (
    subject: ComAtprotoAdminTakeModerationAction.InputSchema['subject'],
  ) =>
    agent.api.com.atproto.admin.takeModerationAction(
      {
        action: TAKEDOWN,
        subject,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_author_feed',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    await server.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it('fetches full author feeds for self (sorted, minimal viewer state).', async () => {
    const aliceForAlice = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceForAlice.data.feed)).toMatchSnapshot()

    const bobForBob = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[bob].handle },
      {
        headers: sc.getHeaders(bob),
      },
    )

    expect(forSnapshot(bobForBob.data.feed)).toMatchSnapshot()

    const carolForCarol = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[carol].handle },
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolForCarol.data.feed)).toMatchSnapshot()

    const danForDan = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[dan].handle },
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(forSnapshot(danForDan.data.feed)).toMatchSnapshot()
  })

  it("reflects fetching user's state in the feed.", async () => {
    const aliceForCarol = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      {
        headers: sc.getHeaders(carol),
      },
    )

    aliceForCarol.data.feed.forEach((postView) => {
      const { viewer, uri } = postView.post
      expect(viewer?.like).toEqual(sc.likes[carol]?.[uri]?.toString())
      expect(viewer?.repost).toEqual(sc.reposts[carol][uri]?.toString())
    })

    expect(forSnapshot(aliceForCarol.data.feed)).toMatchSnapshot()
  })

  it('omits reposts from muted users.', async () => {
    await agent.api.app.bsky.graph.muteActor(
      { actor: alice }, // Has a repost by dan: will be omitted from dan's feed
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    await agent.api.app.bsky.graph.muteActor(
      { actor: dan }, // Feed author: their posts will still appear
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    const bobForDan = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[dan].handle },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(bobForDan.data.feed)).toMatchSnapshot()

    await agent.api.app.bsky.graph.unmuteActor(
      { actor: alice },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    await agent.api.app.bsky.graph.unmuteActor(
      { actor: dan },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getAuthorFeed(
        {
          actor: sc.accounts[alice].handle,
          cursor,
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

    const full = await agent.api.app.bsky.feed.getAuthorFeed(
      {
        actor: sc.accounts[alice].handle,
      },
      { headers: sc.getHeaders(dan) },
    )

    expect(full.data.feed.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('blocked by actor takedown.', async () => {
    const { data: preBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: sc.getHeaders(carol) },
    )

    expect(preBlock.feed.length).toBeGreaterThan(0)

    const { data: action } = await takedownSubject({
      $type: 'com.atproto.admin.defs#repoRef',
      did: alice,
    })

    const { data: postBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: sc.getHeaders(carol) },
    )

    expect(postBlock.feed.length).toEqual(0)

    // Cleanup
    await reverseModerationAction(action.id)
  })

  it('blocked by record takedown.', async () => {
    const { data: preBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: sc.getHeaders(carol) },
    )

    expect(preBlock.feed.length).toBeGreaterThan(0)

    const post = preBlock.feed[0].post

    const { data: action } = await takedownSubject({
      $type: 'com.atproto.repo.strongRef',
      uri: post.uri,
      cid: post.cid,
    })

    const { data: postBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: sc.getHeaders(carol) },
    )

    expect(postBlock.feed.length).toEqual(preBlock.feed.length - 1)
    expect(postBlock.feed.map((item) => item.post.uri)).not.toContain(post.uri)

    // Cleanup
    await reverseModerationAction(action.id)
  })

  it('includes takendown posts for admins', async () => {
    const { data: preTakedown } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: sc.getHeaders(carol) },
    )

    expect(preTakedown.feed.length).toBeGreaterThan(0)

    const post = preTakedown.feed[0].post

    const { data: takedownAction } = await takedownSubject({
      $type: 'com.atproto.repo.strongRef',
      uri: post.uri,
      cid: post.cid,
    })

    const [{ data: postTakedownForCarol }, { data: postTakedownForAdmin }] =
      await Promise.all([
        agent.api.app.bsky.feed.getAuthorFeed(
          { actor: alice },
          { headers: sc.getHeaders(carol) },
        ),
        agent.api.app.bsky.feed.getAuthorFeed(
          { actor: alice },
          { headers: { authorization: adminAuth() } },
        ),
      ])

    const takendownPostInCarolsFeed = postTakedownForCarol.feed.find(
      (item) => item.post.uri === post.uri || !!post.takedownId,
    )
    const takendownPostInAdminsFeed = postTakedownForAdmin.feed.find(
      (item) => item.post.uri === post.uri || !!post.takedownId,
    )
    expect(takendownPostInCarolsFeed).toBeFalsy()
    expect(takendownPostInAdminsFeed).toBeTruthy()
    expect(takendownPostInAdminsFeed?.post.takedownId).toEqual(
      takedownAction.id,
    )

    // Cleanup
    await reverseModerationAction(takedownAction.id)
  })
})
