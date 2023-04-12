import AtpAgent from '@atproto/api'
import { CloseFn, runTestEnv } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import likesSeed from '../seeds/likes'
import {
  constantDate,
  forSnapshot,
  paginateAll,
  processAll,
  stripViewer,
} from '../_util'

describe('pds like views', () => {
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    const testEnv = await runTestEnv({
      dbPostgresSchema: 'views_likes',
    })
    close = testEnv.close
    agent = new AtpAgent({ service: testEnv.bsky.url })
    pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await likesSeed(sc)
    await processAll(testEnv)
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

  it('fetches post likes', async () => {
    const alicePost = await agent.api.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(alicePost.data)).toMatchSnapshot()
    expect(getCursors(alicePost.data.likes)).toEqual(
      getSortedCursors(alicePost.data.likes),
    )
  })

  it('fetches reply likes', async () => {
    const bobReply = await agent.api.app.bsky.feed.getLikes(
      { uri: sc.replies[bob][0].ref.uriStr },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(bobReply.data)).toMatchSnapshot()
    expect(getCursors(bobReply.data.likes)).toEqual(
      getSortedCursors(bobReply.data.likes),
    )
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.likes)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getLikes(
        {
          uri: sc.posts[alice][1].ref.uriStr,
          cursor,
          limit: 2,
        },
        { headers: sc.getHeaders(alice, true) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.likes.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(full.data.likes.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches post likes unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(alice, true) },
    )
    const { data: unauthed } = await agent.api.app.bsky.feed.getLikes({
      uri: sc.posts[alice][1].ref.uriStr,
    })
    expect(unauthed.likes.length).toBeGreaterThan(0)
    expect(unauthed.likes).toEqual(
      authed.likes.map((like) => {
        return {
          ...like,
          actor: stripViewer(like.actor),
        }
      }),
    )
  })
})
