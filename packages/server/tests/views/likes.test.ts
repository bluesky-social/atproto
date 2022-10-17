import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import { SeedClient } from '../seeds/client'
import likesSeed from '../seeds/likes'
import {
  CloseFn,
  constantDate,
  forSnapshot,
  paginateAll,
  runTestServer,
} from '../_util'

describe('pds like views', () => {
  let client: AdxServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_likes',
    })
    close = server.close
    client = AdxApi.service(server.url)
    sc = new SeedClient(client)
    await likesSeed(sc)
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

  it('fetches liked by posts', async () => {
    const alicePost = await client.app.bsky.getLikedBy({
      uri: sc.posts[alice][1].ref.uriStr,
    })

    expect(forSnapshot(alicePost.data)).toMatchSnapshot()
    expect(getCursors(alicePost.data.likedBy)).toEqual(
      getSortedCursors(alicePost.data.likedBy),
    )
  })

  it('fetches liked by replies', async () => {
    const bobReply = await client.app.bsky.getLikedBy({
      uri: sc.replies[bob][0].ref.uriStr,
    })

    expect(forSnapshot(bobReply.data)).toMatchSnapshot()
    expect(getCursors(bobReply.data.likedBy)).toEqual(
      getSortedCursors(bobReply.data.likedBy),
    )
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.likedBy)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.getLikedBy({
        uri: sc.posts[alice][1].ref.uriStr,
        before: cursor,
        limit: 2,
      })
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.likedBy.length).toBeLessThanOrEqual(2),
    )

    const full = await client.app.bsky.getLikedBy({
      uri: sc.posts[alice][1].ref.uriStr,
    })

    expect(full.data.likedBy.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
