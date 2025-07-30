import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, repostsSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { OutputSchema as GetRepostedByOutputSchema } from '../../src/lexicon/types/app/bsky/feed/getRepostedBy'
import { forSnapshot, paginateAll, stripViewer } from '../_util'

describe('pds repost views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_reposts',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await repostsSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches reposted-by for a post', async () => {
    const view = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.posts[alice][2].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetRepostedBy,
        ),
      },
    )
    expect(view.data.uri).toEqual(sc.posts[sc.dids.alice][2].ref.uriStr)
    expect(forSnapshot(view.data.repostedBy)).toMatchSnapshot()
  })

  it('fetches reposted-by for a reply', async () => {
    const view = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.replies[bob][0].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetRepostedBy,
        ),
      },
    )
    expect(view.data.uri).toEqual(sc.replies[sc.dids.bob][0].ref.uriStr)
    expect(forSnapshot(view.data.repostedBy)).toMatchSnapshot()
  })

  it('paginates', async () => {
    const results = (results: GetRepostedByOutputSchema[]) =>
      results.flatMap((res) => res.repostedBy)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getRepostedBy(
        {
          uri: sc.posts[alice][2].ref.uriStr,
          cursor,
          limit: 2,
        },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetRepostedBy,
          ),
        },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.repostedBy.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.posts[alice][2].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetRepostedBy,
        ),
      },
    )

    expect(full.data.repostedBy.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches reposted-by unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.posts[alice][2].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetRepostedBy,
        ),
      },
    )
    const { data: unauthed } = await agent.api.app.bsky.feed.getRepostedBy({
      uri: sc.posts[alice][2].ref.uriStr,
    })
    expect(unauthed.repostedBy.length).toBeGreaterThan(0)
    expect(unauthed.repostedBy).toEqual(authed.repostedBy.map(stripViewer))
  })
})
