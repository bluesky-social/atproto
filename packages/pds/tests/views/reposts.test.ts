import AtpAgent from '@atproto/api'
import { runTestServer, forSnapshot, CloseFn, paginateAll } from '../_util'
import { SeedClient } from '../seeds/client'
import repostsSeed from '../seeds/reposts'

describe('pds repost views', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_reposts',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await repostsSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    await server.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it('fetches reposted-by for a post', async () => {
    const view = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.posts[alice][2].ref.uriStr },
      { headers: sc.getHeaders(alice) },
    )
    expect(view.data.uri).toEqual(sc.posts[sc.dids.alice][2].ref.uriStr)
    expect(forSnapshot(view.data.repostedBy)).toMatchSnapshot()
  })

  it('fetches reposted-by for a reply', async () => {
    const view = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.replies[bob][0].ref.uriStr },
      { headers: sc.getHeaders(alice) },
    )
    expect(view.data.uri).toEqual(sc.replies[sc.dids.bob][0].ref.uriStr)
    expect(forSnapshot(view.data.repostedBy)).toMatchSnapshot()
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.repostedBy)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getRepostedBy(
        {
          uri: sc.posts[alice][2].ref.uriStr,
          cursor,
          limit: 2,
        },
        { headers: sc.getHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.repostedBy.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.posts[alice][2].ref.uriStr },
      { headers: sc.getHeaders(alice) },
    )

    expect(full.data.repostedBy.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
