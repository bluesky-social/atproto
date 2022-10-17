import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import {
  runTestServer,
  forSnapshot,
  constantDate,
  CloseFn,
  paginateAll,
} from '../_util'
import { SeedClient } from '../seeds/client'
import repostsSeed from '../seeds/reposts'

describe('pds repost views', () => {
  let client: AdxServiceClient
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
    client = AdxApi.service(server.url)
    sc = new SeedClient(client)
    await repostsSeed(sc)
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

  it('fetches reposted-by for a post', async () => {
    const view = await client.app.bsky.getRepostedBy({
      uri: sc.posts[alice][2].ref.uriStr,
    })
    expect(view.data.uri).toEqual(sc.posts[sc.dids.alice][2].ref.uriStr)
    expect(forSnapshot(view.data.repostedBy)).toMatchSnapshot()
    expect(getCursors(view.data.repostedBy)).toEqual(
      getSortedCursors(view.data.repostedBy),
    )
  })

  it('fetches reposted-by for a reply', async () => {
    const view = await client.app.bsky.getRepostedBy({
      uri: sc.replies[bob][0].ref.uriStr,
    })
    expect(view.data.uri).toEqual(sc.replies[sc.dids.bob][0].ref.uriStr)
    expect(forSnapshot(view.data.repostedBy)).toMatchSnapshot()
    expect(getCursors(view.data.repostedBy)).toEqual(
      getSortedCursors(view.data.repostedBy),
    )
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.repostedBy)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.getRepostedBy({
        uri: sc.posts[alice][2].ref.uriStr,
        before: cursor,
        limit: 2,
      })
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.repostedBy.length).toBeLessThanOrEqual(2),
    )

    const full = await client.app.bsky.getRepostedBy({
      uri: sc.posts[alice][2].ref.uriStr,
    })

    expect(full.data.repostedBy.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
