import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  constantDate,
  paginateAll,
} from '../_util'
import { SeedClient } from '../seeds/client'
import followsSeed from '../seeds/follows'

describe('pds follow views', () => {
  let client: AdxServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_follows',
    })
    close = server.close
    client = AdxApi.service(server.url)
    sc = new SeedClient(client)
    await followsSeed(sc)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await close()
  })

  const getCursors = (items: { createdAt?: string }[]) =>
    items.map((item) => item.createdAt ?? constantDate)

  const getSortedCursors = (items: { createdAt?: string }[]) =>
    getCursors(items).sort((a, b) => tstamp(b) - tstamp(a))

  const tstamp = (x: string) => new Date(x).getTime()

  it('fetches followers', async () => {
    const aliceFollowers = await client.app.bsky.getUserFollowers({
      user: sc.dids.alice,
    })

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()
    expect(getCursors(aliceFollowers.data.followers)).toEqual(
      getSortedCursors(aliceFollowers.data.followers),
    )

    const bobFollowers = await client.app.bsky.getUserFollowers({
      user: sc.dids.bob,
    })

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()
    expect(getCursors(bobFollowers.data.followers)).toEqual(
      getSortedCursors(bobFollowers.data.followers),
    )

    const carolFollowers = await client.app.bsky.getUserFollowers({
      user: sc.dids.carol,
    })

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()
    expect(getCursors(carolFollowers.data.followers)).toEqual(
      getSortedCursors(carolFollowers.data.followers),
    )

    const danFollowers = await client.app.bsky.getUserFollowers({
      user: sc.dids.dan,
    })

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()
    expect(getCursors(danFollowers.data.followers)).toEqual(
      getSortedCursors(danFollowers.data.followers),
    )

    const eveFollowers = await client.app.bsky.getUserFollowers({
      user: sc.dids.eve,
    })

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
    expect(getCursors(eveFollowers.data.followers)).toEqual(
      getSortedCursors(eveFollowers.data.followers),
    )
  })

  it('fetches followers by username', async () => {
    const byDid = await client.app.bsky.getUserFollowers({
      user: sc.dids.alice,
    })
    const byUsername = await client.app.bsky.getUserFollowers({
      user: sc.accounts[alice].username,
    })
    expect(byUsername.data).toEqual(byDid.data)
  })

  it('paginates followers', async () => {
    const results = (results) => results.flatMap((res) => res.followers)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.getUserFollowers({
        user: sc.dids.alice,
        before: cursor,
        limit: 2,
      })
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.followers.length).toBeLessThanOrEqual(2),
    )

    const full = await client.app.bsky.getUserFollowers({
      user: sc.dids.alice,
    })

    expect(full.data.followers.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches follows', async () => {
    const aliceFollowers = await client.app.bsky.getUserFollows({
      user: sc.dids.alice,
    })

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()
    expect(getCursors(aliceFollowers.data.follows)).toEqual(
      getSortedCursors(aliceFollowers.data.follows),
    )

    const bobFollowers = await client.app.bsky.getUserFollows({
      user: sc.dids.bob,
    })

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()
    expect(getCursors(bobFollowers.data.follows)).toEqual(
      getSortedCursors(bobFollowers.data.follows),
    )

    const carolFollowers = await client.app.bsky.getUserFollows({
      user: sc.dids.carol,
    })

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()
    expect(getCursors(carolFollowers.data.follows)).toEqual(
      getSortedCursors(carolFollowers.data.follows),
    )

    const danFollowers = await client.app.bsky.getUserFollows({
      user: sc.dids.dan,
    })

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()
    expect(getCursors(danFollowers.data.follows)).toEqual(
      getSortedCursors(danFollowers.data.follows),
    )

    const eveFollowers = await client.app.bsky.getUserFollows({
      user: sc.dids.eve,
    })

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
    expect(getCursors(eveFollowers.data.follows)).toEqual(
      getSortedCursors(eveFollowers.data.follows),
    )
  })

  it('fetches follows by username', async () => {
    const byDid = await client.app.bsky.getUserFollows({
      user: sc.dids.alice,
    })
    const byUsername = await client.app.bsky.getUserFollows({
      user: sc.accounts[alice].username,
    })
    expect(byUsername.data).toEqual(byDid.data)
  })

  it('paginates follows', async () => {
    const results = (results) => results.flatMap((res) => res.follows)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.getUserFollows({
        user: sc.dids.alice,
        before: cursor,
        limit: 2,
      })
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.follows.length).toBeLessThanOrEqual(2),
    )

    const full = await client.app.bsky.getUserFollows({
      user: sc.dids.alice,
    })

    expect(full.data.follows.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
