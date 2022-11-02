import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { runTestServer, forSnapshot, CloseFn, paginateAll } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds author feed views', () => {
  let client: AtpServiceClient
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
    client = AtpApi.service(server.url)
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
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceForAlice.data.feed)).toMatchSnapshot()

    const bobForBob = await client.app.bsky.getAuthorFeed(
      { author: sc.accounts[bob].username },
      {
        headers: sc.getHeaders(bob),
      },
    )

    expect(forSnapshot(bobForBob.data.feed)).toMatchSnapshot()

    const carolForCarol = await client.app.bsky.getAuthorFeed(
      { author: sc.accounts[carol].username },
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolForCarol.data.feed)).toMatchSnapshot()

    const danForDan = await client.app.bsky.getAuthorFeed(
      { author: sc.accounts[dan].username },
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(forSnapshot(danForDan.data.feed)).toMatchSnapshot()
  })

  it("reflects fetching user's state in the feed.", async () => {
    const aliceForCarol = await client.app.bsky.getAuthorFeed(
      { author: sc.accounts[alice].username },
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
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.getAuthorFeed(
        {
          author: sc.accounts[alice].username,
          before: cursor,
          limit: 2,
        },
        { headers: sc.getHeaders(dan) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(2),
    )

    const full = await client.app.bsky.getAuthorFeed(
      {
        author: sc.accounts[alice].username,
      },
      { headers: sc.getHeaders(dan) },
    )

    expect(full.data.feed.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
