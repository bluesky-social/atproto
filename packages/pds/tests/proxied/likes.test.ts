import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import likesSeed from '../seeds/likes'
import { constantDate, forSnapshot, paginateAll } from '../_util'

describe('pds like proxy views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_likes',
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await likesSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await network.close()
  })

  const getCursors = (items: { createdAt?: string }[]) =>
    items.map((item) => item.createdAt ?? constantDate)

  const getSortedCursors = (items: { createdAt?: string }[]) =>
    getCursors(items).sort((a, b) => tstamp(b) - tstamp(a))

  const tstamp = (x: string) => new Date(x).getTime()

  it('fetches post likes', async () => {
    const alicePost = await agent.api.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(alicePost.data)).toMatchSnapshot()
    expect(getCursors(alicePost.data.likes)).toEqual(
      getSortedCursors(alicePost.data.likes),
    )
  })

  it('fetches reply likes', async () => {
    const bobReply = await agent.api.app.bsky.feed.getLikes(
      { uri: sc.replies[bob][0].ref.uriStr },
      { headers: sc.getHeaders(alice) },
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
        { headers: sc.getHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.likes.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(alice) },
    )

    expect(full.data.likes.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
