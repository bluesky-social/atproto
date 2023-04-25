import AtpAgent from '@atproto/api'
import { TestEnvInfo, runTestEnv } from '@atproto/dev-env'
import {
  appViewHeaders,
  forSnapshot,
  paginateAll,
  processAll,
  stripViewer,
} from '../_util'
import { SeedClient } from '../seeds/client'
import repostsSeed from '../seeds/reposts'

describe('pds repost views', () => {
  let agent: AtpAgent
  let testEnv: TestEnvInfo
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'bsky_views_reposts',
    })
    agent = new AtpAgent({ service: testEnv.bsky.url })
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await repostsSeed(sc)
    await processAll(testEnv)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await testEnv.close()
  })

  it('fetches reposted-by for a post', async () => {
    const view = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.posts[alice][2].ref.uriStr },
      { headers: await appViewHeaders(alice, testEnv) },
    )
    expect(view.data.uri).toEqual(sc.posts[sc.dids.alice][2].ref.uriStr)
    expect(forSnapshot(view.data.repostedBy)).toMatchSnapshot()
  })

  it('fetches reposted-by for a reply', async () => {
    const view = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.replies[bob][0].ref.uriStr },
      { headers: await appViewHeaders(alice, testEnv) },
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
        { headers: await appViewHeaders(alice, testEnv) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.repostedBy.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.posts[alice][2].ref.uriStr },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(full.data.repostedBy.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches reposted-by unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.posts[alice][2].ref.uriStr },
      { headers: await appViewHeaders(alice, testEnv) },
    )
    const { data: unauthed } = await agent.api.app.bsky.feed.getRepostedBy({
      uri: sc.posts[alice][2].ref.uriStr,
    })
    expect(unauthed.repostedBy.length).toBeGreaterThan(0)
    expect(unauthed.repostedBy).toEqual(authed.repostedBy.map(stripViewer))
  })
})
