import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { forSnapshot, paginateAll, stripViewerFromPost } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { isRecord } from '../../src/lexicon/types/app/bsky/feed/post'
import { isView as isEmbedRecordWithMedia } from '../../src/lexicon/types/app/bsky/embed/recordWithMedia'
import { isView as isImageEmbed } from '../../src/lexicon/types/app/bsky/embed/images'

describe('pds author feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_author_feed',
    })
    agent = network.bsky.getClient()
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await network.close()
  })

  // @TODO(bsky) blocked by actor takedown via labels.
  // @TODO(bsky) blocked by record takedown via labels.

  it('fetches full author feeds for self (sorted, minimal viewer state).', async () => {
    const aliceForAlice = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      { headers: await network.serviceHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data.feed)).toMatchSnapshot()

    const bobForBob = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[bob].handle },
      { headers: await network.serviceHeaders(bob) },
    )

    expect(forSnapshot(bobForBob.data.feed)).toMatchSnapshot()

    const carolForCarol = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[carol].handle },
      { headers: await network.serviceHeaders(carol) },
    )

    expect(forSnapshot(carolForCarol.data.feed)).toMatchSnapshot()

    const danForDan = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[dan].handle },
      { headers: await network.serviceHeaders(dan) },
    )

    expect(forSnapshot(danForDan.data.feed)).toMatchSnapshot()
  })

  it("reflects fetching user's state in the feed.", async () => {
    const aliceForCarol = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      { headers: await network.serviceHeaders(carol) },
    )

    aliceForCarol.data.feed.forEach((postView) => {
      const { viewer, uri } = postView.post
      expect(viewer?.like).toEqual(sc.likes[carol][uri]?.toString())
      expect(viewer?.repost).toEqual(sc.reposts[carol][uri]?.toString())
    })

    expect(forSnapshot(aliceForCarol.data.feed)).toMatchSnapshot()
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
        { headers: await network.serviceHeaders(dan) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      { headers: await network.serviceHeaders(dan) },
    )

    expect(full.data.feed.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches results unauthed.', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      { headers: await network.serviceHeaders(alice) },
    )
    const { data: unauthed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: sc.accounts[alice].handle,
    })
    expect(unauthed.feed.length).toBeGreaterThan(0)
    expect(unauthed.feed).toEqual(
      authed.feed.map((item) => {
        const result = {
          ...item,
          post: stripViewerFromPost(item.post),
        }
        if (item.reply) {
          result.reply = {
            parent: stripViewerFromPost(item.reply.parent),
            root: stripViewerFromPost(item.reply.root),
          }
        }
        return result
      }),
    )
  })

  it('blocked by actor takedown.', async () => {
    const { data: preBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: await network.serviceHeaders(carol) },
    )

    expect(preBlock.feed.length).toBeGreaterThan(0)

    const { data: action } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: alice,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )

    try {
      const { data: postBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: alice },
        { headers: await network.serviceHeaders(carol) },
      )
    } catch (e: any) {
      expect(e.message).toEqual('Profile not found')
    }

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: action.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
  })

  it('blocked by record takedown.', async () => {
    const { data: preBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: await network.serviceHeaders(carol) },
    )

    expect(preBlock.feed.length).toBeGreaterThan(0)

    const post = preBlock.feed[0].post

    const { data: action } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: post.uri,
            cid: post.cid,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )

    const { data: postBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: await network.serviceHeaders(carol) },
    )

    expect(postBlock.feed.length).toEqual(preBlock.feed.length - 1)
    expect(postBlock.feed.map((item) => item.post.uri)).not.toContain(post.uri)

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: action.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
  })

  it('can filter by posts_with_media', async () => {
    const { data: carolFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: carol,
      filter: 'posts_with_media',
    })

    expect(carolFeed.feed.length).toBeGreaterThan(0)
    expect(
      carolFeed.feed.every(({ post }) => {
        const isRecordWithActorMedia =
          isEmbedRecordWithMedia(post.embed) && isImageEmbed(post.embed?.media)
        const isActorMedia = isImageEmbed(post.embed)
        const isFromActor = post.author.did === carol

        return (isRecordWithActorMedia || isActorMedia) && isFromActor
      }),
    ).toBeTruthy()

    const { data: bobFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: bob,
      filter: 'posts_with_media',
    })

    expect(
      bobFeed.feed.every(({ post }) => {
        return isImageEmbed(post.embed) && post.author.did === bob
      }),
    ).toBeTruthy()

    const { data: danFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: dan,
      filter: 'posts_with_media',
    })

    expect(danFeed.feed.length).toEqual(0)
  })

  it('filters by posts_no_replies', async () => {
    const { data: postsOnlyFeed } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: carol, filter: 'posts_no_replies' },
    )

    expect(
      postsOnlyFeed.feed.every(({ post }) => {
        return isRecord(post.record) && !post.record.reply
      }),
    ).toBeTruthy()
  })
})
