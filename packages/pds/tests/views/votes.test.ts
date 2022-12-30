import AtpApi, {
  AppBskyFeedGetPostThread,
  ServiceClient as AtpServiceClient,
} from '@atproto/api'
import { SeedClient } from '../seeds/client'
import votesSeed from '../seeds/votes'
import {
  CloseFn,
  constantDate,
  forSnapshot,
  paginateAll,
  runTestServer,
} from '../_util'

describe('pds vote views', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_votes',
    })
    close = server.close
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await votesSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await close()
  })

  const getCursors = (items: { createdAt?: string }[]) =>
    items.map((item) => item.createdAt ?? constantDate)

  const getSortedCursors = (items: { createdAt?: string }[]) =>
    getCursors(items).sort((a, b) => tstamp(b) - tstamp(a))

  const tstamp = (x: string) => new Date(x).getTime()

  it('fetches post votes', async () => {
    const alicePost = await client.app.bsky.feed.getVotes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(alicePost.data)).toMatchSnapshot()
    expect(getCursors(alicePost.data.votes)).toEqual(
      getSortedCursors(alicePost.data.votes),
    )
  })

  it('fetches reply votes', async () => {
    const bobReply = await client.app.bsky.feed.getVotes(
      { uri: sc.replies[bob][0].ref.uriStr },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(bobReply.data)).toMatchSnapshot()
    expect(getCursors(bobReply.data.votes)).toEqual(
      getSortedCursors(bobReply.data.votes),
    )
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.votes)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.feed.getVotes(
        {
          uri: sc.posts[alice][1].ref.uriStr,
          before: cursor,
          limit: 2,
        },
        { headers: sc.getHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.votes.length).toBeLessThanOrEqual(2),
    )

    const full = await client.app.bsky.feed.getVotes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(alice) },
    )

    expect(full.data.votes.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('filters by direction', async () => {
    const full = await client.app.bsky.feed.getVotes(
      {
        uri: sc.posts[alice][1].ref.uriStr,
      },
      { headers: sc.getHeaders(alice) },
    )

    const upvotes = await client.app.bsky.feed.getVotes(
      {
        uri: sc.posts[alice][1].ref.uriStr,
        direction: 'up',
      },
      { headers: sc.getHeaders(alice) },
    )

    const downvotes = await client.app.bsky.feed.getVotes(
      {
        uri: sc.posts[alice][1].ref.uriStr,
        direction: 'down',
      },
      { headers: sc.getHeaders(alice) },
    )

    expect(upvotes.data.votes.length).toEqual(2)
    upvotes.data.votes.forEach((vote) => {
      expect(vote.direction).toEqual('up')
    })

    expect(downvotes.data.votes.length).toEqual(2)
    downvotes.data.votes.forEach((vote) => {
      expect(vote.direction).toEqual('down')
    })

    // Upvote filter and downvote filter comprise all votes
    const upAndDownvotes = upvotes.data.votes.concat(downvotes.data.votes)
    expect(full.data.votes.length).toEqual(4)
    full.data.votes.forEach((vote) => {
      upAndDownvotes.some(
        (v) => v.direction === vote.direction && v.actor.did === vote.actor.did,
      )
    })
  })

  describe('setVote()', () => {
    it('sets and clears votes', async () => {
      const asAlice = {
        encoding: 'application/json',
        headers: sc.getHeaders(alice),
      } as const

      let post: AppBskyFeedGetPostThread.OutputSchema
      const getPost = async () => {
        const result = await client.app.bsky.feed.getPostThread(
          {
            uri: sc.posts[bob][0].ref.uriStr,
            depth: 0,
          },
          asAlice,
        )
        return result.data
      }

      post = await getPost()

      expect(
        (post.thread.post as AppBskyFeedGetPostThread.ThreadViewPost)
          .downvoteCount,
      ).toEqual(0)
      expect(
        (post.thread.post as AppBskyFeedGetPostThread.ThreadViewPost).viewer,
      ).toEqual({})

      // Upvote
      const { data: upvoted } = await client.app.bsky.feed.setVote(
        {
          direction: 'up',
          subject: {
            uri: sc.posts[bob][0].ref.uriStr,
            cid: sc.posts[bob][0].ref.cidStr,
          },
        },
        asAlice,
      )
      post = await getPost()
      expect(upvoted.upvote).not.toBeUndefined()
      expect(upvoted.downvote).toBeUndefined()
      expect(
        (post.thread.post as AppBskyFeedGetPostThread.ThreadViewPost)
          .upvoteCount,
      ).toEqual(1)
      expect(
        (post.thread.post as AppBskyFeedGetPostThread.ThreadViewPost)
          .downvoteCount,
      ).toEqual(0)
      expect(
        (post.thread.post as AppBskyFeedGetPostThread.ThreadViewPost).viewer,
      ).toEqual(upvoted)

      // Downvote
      const { data: downvoted } = await client.app.bsky.feed.setVote(
        {
          direction: 'down',
          subject: {
            uri: sc.posts[bob][0].ref.uriStr,
            cid: sc.posts[bob][0].ref.cidStr,
          },
        },
        asAlice,
      )
      post = await getPost()
      expect(downvoted.upvote).toBeUndefined()
      expect(downvoted.downvote).not.toBeUndefined()
      expect(
        (post.thread.post as AppBskyFeedGetPostThread.ThreadViewPost)
          .upvoteCount,
      ).toEqual(0)
      expect(
        (post.thread.post as AppBskyFeedGetPostThread.ThreadViewPost)
          .downvoteCount,
      ).toEqual(1)
      expect(
        (post.thread.post as AppBskyFeedGetPostThread.ThreadViewPost).viewer,
      ).toEqual(downvoted)

      // No vote
      const { data: novoted } = await client.app.bsky.feed.setVote(
        {
          direction: 'none',
          subject: {
            uri: sc.posts[bob][0].ref.uriStr,
            cid: sc.posts[bob][0].ref.cidStr,
          },
        },
        asAlice,
      )
      post = await getPost()
      expect(novoted.upvote).toBeUndefined()
      expect(novoted.downvote).toBeUndefined()
      expect(
        (post.thread.post as AppBskyFeedGetPostThread.ThreadViewPost)
          .upvoteCount,
      ).toEqual(0)
      expect(
        (post.thread.post as AppBskyFeedGetPostThread.ThreadViewPost)
          .downvoteCount,
      ).toEqual(0)
      expect(
        (post.thread.post as AppBskyFeedGetPostThread.ThreadViewPost).viewer,
      ).toEqual(novoted)
    })

    it('no-ops when already in correct state', async () => {
      const asAlice = {
        encoding: 'application/json',
        headers: sc.getHeaders(alice),
      } as const

      const { data: upvotedA } = await client.app.bsky.feed.setVote(
        {
          direction: 'up',
          subject: {
            uri: sc.posts[bob][0].ref.uriStr,
            cid: sc.posts[bob][0].ref.cidStr,
          },
        },
        asAlice,
      )

      const { data: upvotedB } = await client.app.bsky.feed.setVote(
        {
          direction: 'up',
          subject: {
            uri: sc.posts[bob][0].ref.uriStr,
            cid: sc.posts[bob][0].ref.cidStr,
          },
        },
        asAlice,
      )

      expect(upvotedA).toEqual(upvotedB)
    })
  })
})
