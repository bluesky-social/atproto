import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import {
  runTestServer,
  forSnapshot,
  getCursors,
  getSortedCursors,
  CloseFn,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds author feed views', () => {
  let client: AdxServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_author_feed',
    })
    close = server.close
    client = AdxApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await close()
  })

  it('fetches full author feeds for self (sorted, minimal myState).', async () => {
    const aliceForAlice = await client.app.bsky.getAuthorFeed(
      { author: sc.accounts[alice].username },
      undefined,
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceForAlice.data.feed)).toMatchSnapshot()
    expect(getCursors(aliceForAlice.data.feed)).toEqual(
      getSortedCursors(aliceForAlice.data.feed),
    )

    const bobForBob = await client.app.bsky.getAuthorFeed(
      { author: sc.accounts[bob].username },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )

    expect(forSnapshot(bobForBob.data.feed)).toMatchSnapshot()
    expect(getCursors(bobForBob.data.feed)).toEqual(
      getSortedCursors(bobForBob.data.feed),
    )

    const carolForCarol = await client.app.bsky.getAuthorFeed(
      { author: sc.accounts[carol].username },
      undefined,
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolForCarol.data.feed)).toMatchSnapshot()
    expect(getCursors(carolForCarol.data.feed)).toEqual(
      getSortedCursors(carolForCarol.data.feed),
    )

    const danForDan = await client.app.bsky.getAuthorFeed(
      { author: sc.accounts[dan].username },
      undefined,
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(forSnapshot(danForDan.data.feed)).toMatchSnapshot()
    expect(getCursors(danForDan.data.feed)).toEqual(
      getSortedCursors(danForDan.data.feed),
    )
  })

  it("reflects fetching user's state in the feed.", async () => {
    const aliceForCarol = await client.app.bsky.getAuthorFeed(
      { author: sc.accounts[alice].username },
      undefined,
      {
        headers: sc.getHeaders(carol),
      },
    )

    aliceForCarol.data.feed.forEach(({ uri, myState }) => {
      expect(myState?.like).toEqual(sc.likes[carol][uri]?.toString())
      expect(myState?.repost).toEqual(sc.reposts[carol][uri]?.toString())
    })

    expect(forSnapshot(aliceForCarol.data.feed)).toMatchSnapshot()
  })

  it('paginates', async () => {
    const full = await client.app.bsky.getAuthorFeed(
      { author: sc.accounts[alice].username },
      undefined,
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(full.data.feed.length).toEqual(4)

    const paginated = await client.app.bsky.getAuthorFeed(
      {
        author: sc.accounts[alice].username,
        before: full.data.feed[0].cursor,
        limit: 2,
      },
      undefined,
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(paginated.data.feed).toEqual(full.data.feed.slice(1, 3))
  })
})
