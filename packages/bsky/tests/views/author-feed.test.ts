import assert from 'node:assert'
import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, authorFeedSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import {
  Record as Profile,
  validateRecord as validatePostRecord,
} from '../../src/lexicon/types/app/bsky/actor/profile'
import { isView as isImageEmbed } from '../../src/lexicon/types/app/bsky/embed/images'
import { isView as isEmbedRecordWithMedia } from '../../src/lexicon/types/app/bsky/embed/recordWithMedia'
import { isView as isVideoEmbed } from '../../src/lexicon/types/app/bsky/embed/video'
import {
  isPostView,
  isReasonPin,
} from '../../src/lexicon/types/app/bsky/feed/defs'
import { OutputSchema as GetAuthorFeedOutputSchema } from '../../src/lexicon/types/app/bsky/feed/getAuthorFeed'
import {
  ReplyRef,
  isRecord,
  validateReplyRef,
} from '../../src/lexicon/types/app/bsky/feed/post'
import { asPredicate } from '../../src/lexicon/util'
import { uriToDid } from '../../src/util/uris'
import { VideoEmbed } from '../../src/views/types'
import {
  forSnapshot,
  paginateAll,
  stripViewer,
  stripViewerFromPost,
} from '../_util'

const isValidReplyRef = asPredicate(validateReplyRef)
const isValidProfile = asPredicate(validatePostRecord)

describe('pds author feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string
  let eve: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_author_feed',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await authorFeedSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    eve = sc.dids.eve
  })

  afterAll(async () => {
    await network.close()
  })

  // @TODO(bsky) blocked by actor takedown via labels.
  // @TODO(bsky) blocked by record takedown via labels.

  it('fetches full author feeds for self (sorted, minimal viewer state).', async () => {
    const aliceForAlice = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )

    expect(forSnapshot(aliceForAlice.data.feed)).toMatchSnapshot()

    const bobForBob = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[bob].handle },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )

    expect(forSnapshot(bobForBob.data.feed)).toMatchSnapshot()

    const carolForCarol = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[carol].handle },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )

    expect(forSnapshot(carolForCarol.data.feed)).toMatchSnapshot()

    const danForDan = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[dan].handle },
      {
        headers: await network.serviceHeaders(
          dan,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )

    expect(forSnapshot(danForDan.data.feed)).toMatchSnapshot()
  })

  it("reflects fetching user's state in the feed.", async () => {
    const aliceForCarol = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )

    aliceForCarol.data.feed.forEach((postView) => {
      const { viewer, uri } = postView.post
      expect(viewer?.like).toEqual(sc.likes[carol][uri]?.toString())
      expect(viewer?.repost).toEqual(sc.reposts[carol][uri]?.toString())
    })

    expect(forSnapshot(aliceForCarol.data.feed)).toMatchSnapshot()
  })

  it('paginates', async () => {
    const results = (results: GetAuthorFeedOutputSchema[]) =>
      results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getAuthorFeed(
        {
          actor: sc.accounts[alice].handle,
          cursor,
          limit: 2,
        },
        {
          headers: await network.serviceHeaders(
            dan,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      {
        headers: await network.serviceHeaders(
          dan,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )

    expect(full.data.feed.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches results unauthed.', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
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
            parent: stripViewerFromPost(item.reply.parent, true),
            root: stripViewerFromPost(item.reply.root, true),
            grandparentAuthor:
              item.reply.grandparentAuthor &&
              stripViewer(item.reply.grandparentAuthor),
          }
        }
        return result
      }),
    )
  })

  it('non-admins blocked by actor takedown.', async () => {
    const { data: preBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )

    expect(preBlock.feed.length).toBeGreaterThan(0)

    await network.bsky.ctx.dataplane.takedownActor({
      did: alice,
    })

    const attemptAsUser = agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )
    await expect(attemptAsUser).rejects.toThrow('Profile not found')

    const attemptAsAdmin = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: network.bsky.adminAuthHeaders() },
    )
    expect(attemptAsAdmin.data.feed.length).toEqual(preBlock.feed.length)

    // Cleanup
    await network.bsky.ctx.dataplane.untakedownActor({
      did: alice,
    })
  })

  it('blocked by record takedown.', async () => {
    const { data: preBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )

    expect(preBlock.feed.length).toBeGreaterThan(0)

    const post = preBlock.feed[0].post

    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: post.uri,
    })

    const [{ data: postBlockAsUser }, { data: postBlockAsAdmin }] =
      await Promise.all([
        agent.api.app.bsky.feed.getAuthorFeed(
          { actor: alice },
          {
            headers: await network.serviceHeaders(
              carol,
              ids.AppBskyFeedGetAuthorFeed,
            ),
          },
        ),
        agent.api.app.bsky.feed.getAuthorFeed(
          { actor: alice },
          { headers: network.bsky.adminAuthHeaders() },
        ),
      ])

    expect(postBlockAsUser.feed.length).toEqual(preBlock.feed.length - 1)
    expect(postBlockAsUser.feed.map((item) => item.post.uri)).not.toContain(
      post.uri,
    )
    expect(postBlockAsAdmin.feed.length).toEqual(preBlock.feed.length)
    expect(postBlockAsAdmin.feed.map((item) => item.post.uri)).toContain(
      post.uri,
    )

    // Cleanup
    await network.bsky.ctx.dataplane.untakedownRecord({
      recordUri: post.uri,
    })
  })

  it('can filter by posts_with_media', async () => {
    const { data: carolFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: carol,
      filter: 'posts_with_media',
    })

    expect(carolFeed.feed.length).toBeGreaterThan(0)
    assert(
      carolFeed.feed.every(({ post }) => {
        const isRecordWithActorMedia =
          isEmbedRecordWithMedia(post.embed) && isImageEmbed(post.embed?.media)
        const isActorMedia = isImageEmbed(post.embed)
        const isFromActor = post.author.did === carol

        return (isRecordWithActorMedia || isActorMedia) && isFromActor
      }),
    )

    const { data: bobFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: bob,
      filter: 'posts_with_media',
    })

    assert(
      bobFeed.feed.every(({ post }) => {
        return isImageEmbed(post.embed) && post.author.did === bob
      }),
    )

    const { data: danFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: dan,
      filter: 'posts_with_media',
    })

    expect(danFeed.feed.length).toEqual(0)
  })

  it('can filter by posts_with_video', async () => {
    const { data: carolFeedBefore } =
      await agent.api.app.bsky.feed.getAuthorFeed({
        actor: carol,
        filter: 'posts_with_video',
      })
    expect(carolFeedBefore.feed).toHaveLength(0)

    const { data: video } = await pdsAgent.api.com.atproto.repo.uploadBlob(
      Buffer.from('notarealvideo'),
      {
        headers: sc.getHeaders(sc.dids.carol),
        encoding: 'image/mp4',
      },
    )

    await sc.post(carol, 'video post', undefined, undefined, undefined, {
      embed: {
        $type: 'app.bsky.embed.video',
        video: video.blob,
        alt: 'alt text',
        aspectRatio: { height: 3, width: 4 },
      } satisfies VideoEmbed,
    })
    await network.processAll()

    const { data: carolFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: carol,
      filter: 'posts_with_video',
    })

    expect(carolFeed.feed).toHaveLength(1)
    expect(
      carolFeed.feed.every(({ post }) => {
        const isRecordWithActorMedia =
          isEmbedRecordWithMedia(post.embed) && isVideoEmbed(post.embed?.media)
        const isActorMedia = isVideoEmbed(post.embed)
        const isFromActor = post.author.did === carol

        return (isRecordWithActorMedia || isActorMedia) && isFromActor
      }),
    ).toBeTruthy()

    const { data: bobFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: bob,
      filter: 'posts_with_video',
    })

    expect(
      bobFeed.feed.every(({ post }) => {
        return isVideoEmbed(post.embed) && post.author.did === bob
      }),
    ).toBeTruthy()

    const { data: danFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: dan,
      filter: 'posts_with_video',
    })

    expect(danFeed.feed.length).toEqual(0)
  })

  it('filters by posts_no_replies', async () => {
    const { data: carolFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: carol,
      filter: 'posts_no_replies',
    })

    assert(
      carolFeed.feed.every(({ post }) => {
        return (
          (isRecord(post.record) && !post.record.reply) ||
          (isRecord(post.record) && post.record.reply)
        )
      }),
    )

    const { data: danFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: dan,
      filter: 'posts_no_replies',
    })

    expect(
      danFeed.feed.every(({ post }) => {
        return (
          (isRecord(post.record) && !post.record.reply) ||
          (isRecord(post.record) && post.record.reply)
        )
      }),
    ).toBeTruthy()
  })

  it('posts_and_author_threads includes self-replies', async () => {
    const { data: eveFeed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: eve,
      filter: 'posts_and_author_threads',
    })

    expect(eveFeed.feed.length).toEqual(6)
    expect(
      eveFeed.feed.some(({ post }) => {
        const replyByEve =
          isRecord(post.record) && post.record.reply && post.author.did === eve
        return replyByEve
      }),
    ).toBeTruthy()
    // does not include eve's replies to fred, even within her own thread.
    expect(
      eveFeed.feed.every(({ post, reply }) => {
        if (
          !post ||
          !isRecord(post.record) ||
          !isValidReplyRef(post.record.reply)
        ) {
          return true // not a reply
        }
        const replyToEve = isReplyTo(post.record.reply, eve)
        const replyToReplyByEve =
          reply &&
          isPostView(reply.parent) &&
          isRecord(reply.parent.record) &&
          (!isValidReplyRef(reply.parent.record.reply) ||
            isReplyTo(reply.parent.record.reply, eve))
        return replyToEve && replyToReplyByEve
      }),
    ).toBeTruthy()
    // reposts are preserved
    expect(
      eveFeed.feed.some(({ post, reason }) => {
        const repostOfOther =
          reason && isRecord(post.record) && post.author.did !== eve
        return repostOfOther
      }),
    ).toBeTruthy()
  })

  describe('pins', () => {
    async function createAndPinPost() {
      const post = await sc.post(alice, 'pinned post')
      await network.processAll()

      const profile = await pdsAgent.com.atproto.repo.getRecord({
        repo: alice,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
      })

      assert(isValidProfile(profile.data.value))

      const newProfile: Profile = {
        ...profile.data.value,
        pinnedPost: {
          uri: post.ref.uriStr,
          cid: post.ref.cid.toString(),
        },
      }

      await sc.updateProfile(alice, newProfile)

      await network.processAll()

      return post
    }

    it('params.includePins = true, pin is in first page of results', async () => {
      await sc.post(alice, 'not pinned post')
      const post = await createAndPinPost()
      await sc.post(alice, 'not pinned post')
      await network.processAll()
      const { data } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.accounts[alice].handle, includePins: true },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      )

      const pinnedPosts = data.feed.filter(
        (item) => item.post.uri === post.ref.uriStr,
      )
      expect(pinnedPosts.length).toEqual(1)

      const pinnedPost = data.feed.at(0)
      expect(pinnedPost?.post?.uri).toEqual(post.ref.uriStr)
      assert(pinnedPost?.post?.viewer?.pinned)
      assert(isReasonPin(pinnedPost?.reason))

      const notPinnedPost = data.feed.at(1)
      expect(notPinnedPost?.post?.viewer?.pinned).toBeFalsy()
      expect(forSnapshot(data.feed)).toMatchSnapshot()
    })

    it('params.includePins = true, pin is NOT in first page of results', async () => {
      const post = await createAndPinPost()
      await sc.post(alice, 'not pinned post')
      await sc.post(alice, 'not pinned post')
      await network.processAll()
      const { data: page1 } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.accounts[alice].handle, includePins: true, limit: 2 },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      )

      // exists with `reason`
      const pinnedPost = page1.feed.find(
        (item) => item.post.uri === post.ref.uriStr,
      )
      expect(pinnedPost?.post?.uri).toEqual(post.ref.uriStr)
      assert(pinnedPost?.post?.viewer?.pinned)
      assert(isReasonPin(pinnedPost?.reason))
      expect(forSnapshot(page1.feed)).toMatchSnapshot()

      const { data: page2 } = await agent.api.app.bsky.feed.getAuthorFeed(
        {
          actor: sc.accounts[alice].handle,
          includePins: true,
          cursor: page1.cursor,
        },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      )

      // exists without `reason`
      const laterPinnedPost = page2.feed.find(
        (item) => item.post.uri === post.ref.uriStr,
      )
      expect(laterPinnedPost?.post?.uri).toEqual(post.ref.uriStr)
      assert(laterPinnedPost?.post?.viewer?.pinned)
      expect(isReasonPin(laterPinnedPost?.reason)).toBeFalsy()
      expect(forSnapshot(page2.feed)).toMatchSnapshot()
    })

    it('params.includePins = false', async () => {
      const post = await createAndPinPost()
      const { data } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.accounts[alice].handle },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      )

      // exists without `reason`
      const pinnedPost = data.feed.find(
        (item) => item.post.uri === post.ref.uriStr,
      )
      expect(isReasonPin(pinnedPost?.reason)).toBeFalsy()
      expect(forSnapshot(data.feed)).toMatchSnapshot()
    })

    it("cannot pin someone else's post", async () => {
      const bobPost = await sc.post(bob, 'pinned post')
      await sc.post(alice, 'not pinned post')
      await network.processAll()

      const profile = await pdsAgent.com.atproto.repo.getRecord({
        repo: alice,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
      })

      assert(isValidProfile(profile.data.value))

      const newProfile: Profile = {
        ...profile.data.value,
        pinnedPost: {
          uri: bobPost.ref.uriStr,
          cid: bobPost.ref.cid.toString(),
        },
      }

      await sc.updateProfile(alice, newProfile)

      await network.processAll()

      const { data } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.accounts[alice].handle },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      )

      const pinnedPost = data.feed.find(
        (item) => item.post.uri === bobPost.ref.uriStr,
      )
      expect(pinnedPost).toBeUndefined()
      expect(forSnapshot(data.feed)).toMatchSnapshot()
    })
  })
})

function isReplyTo(reply: ReplyRef, did: string) {
  return uriToDid(reply.root.uri) === did && uriToDid(reply.parent.uri) === did
}
