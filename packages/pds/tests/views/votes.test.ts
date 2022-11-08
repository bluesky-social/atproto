import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
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
    const alicePost = await client.app.bsky.feed.getVotes({
      uri: sc.posts[alice][1].ref.uriStr,
    })

    expect(forSnapshot(alicePost.data)).toMatchSnapshot()
    expect(getCursors(alicePost.data.votes)).toEqual(
      getSortedCursors(alicePost.data.votes),
    )
  })

  it('fetches reply votes', async () => {
    const bobReply = await client.app.bsky.feed.getVotes({
      uri: sc.replies[bob][0].ref.uriStr,
    })

    expect(forSnapshot(bobReply.data)).toMatchSnapshot()
    expect(getCursors(bobReply.data.votes)).toEqual(
      getSortedCursors(bobReply.data.votes),
    )
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.votes)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.feed.getVotes({
        uri: sc.posts[alice][1].ref.uriStr,
        before: cursor,
        limit: 2,
      })
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.votes.length).toBeLessThanOrEqual(2),
    )

    const full = await client.app.bsky.feed.getVotes({
      uri: sc.posts[alice][1].ref.uriStr,
    })

    expect(full.data.votes.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('filters by direction', async () => {
    const full = await client.app.bsky.feed.getVotes({
      uri: sc.posts[alice][1].ref.uriStr,
    })

    const upvotes = await client.app.bsky.feed.getVotes({
      uri: sc.posts[alice][1].ref.uriStr,
      direction: 'up',
    })

    const downvotes = await client.app.bsky.feed.getVotes({
      uri: sc.posts[alice][1].ref.uriStr,
      direction: 'down',
    })

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
})
