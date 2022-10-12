import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import { SeedClient } from '../seeds/client'
import likesSeed from '../seeds/likes'
import { CloseFn, constantDate, forSnapshot, runTestServer } from '../_util'

describe('pds like views', () => {
  let client: AdxServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let dan: string

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
    dan = sc.dids.dan
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
    const alicePost = await client.todo.social.getLikedBy({
      uri: sc.posts[alice][1].uriRaw,
    })

    expect(forSnapshot(alicePost.data)).toMatchSnapshot()
    expect(getCursors(alicePost.data.likedBy)).toEqual(
      getSortedCursors(alicePost.data.likedBy),
    )
  })

  it('fetches liked by replies', async () => {
    const bobReply = await client.todo.social.getLikedBy({
      uri: sc.replies[bob][0].uriRaw,
    })

    expect(forSnapshot(bobReply.data)).toMatchSnapshot()
    expect(getCursors(bobReply.data.likedBy)).toEqual(
      getSortedCursors(bobReply.data.likedBy),
    )
  })

  it('fetches liked by reposts', async () => {
    const danReply = await client.todo.social.getLikedBy({
      uri: sc.reposts[dan][0].toString(),
    })

    expect(forSnapshot(danReply.data)).toMatchSnapshot()
    expect(getCursors(danReply.data.likedBy)).toEqual(
      getSortedCursors(danReply.data.likedBy),
    )
  })

  it('paginates', async () => {
    const full = await client.todo.social.getLikedBy({
      uri: sc.posts[alice][1].uriRaw,
    })

    expect(full.data.likedBy.length).toEqual(4)

    const paginated = await client.todo.social.getLikedBy({
      uri: sc.posts[alice][1].uriRaw,
      before: full.data.likedBy[0].createdAt,
      limit: 2,
    })

    expect(paginated.data.likedBy).toEqual(full.data.likedBy.slice(1, 3))
  })
})
