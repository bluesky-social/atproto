import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { SeedClient } from '../seeds/client'
import likesSeed from '../seeds/likes'
import {
  CloseFn,
  constantDate,
  forSnapshot,
  paginateAll,
  runTestServer,
} from '../_util'

describe('pds badge members view', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let bob: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_badge_members',
    })
    close = server.close
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await likesSeed(sc)
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await close()
  })

  const getCursors = (items: { acceptedAt?: string }[]) =>
    items.map((item) => item.acceptedAt ?? constantDate)

  const getSortedCursors = (items: { acceptedAt?: string }[]) =>
    getCursors(items).sort((a, b) => tstamp(b) - tstamp(a))

  const tstamp = (x: string) => new Date(x).getTime()

  it('fetch members of a badge', async () => {
    const badgeMembers = await client.app.bsky.getBadgeMembers({
      uri: sc.badges[bob][1].uriStr,
    })

    expect(forSnapshot(badgeMembers.data)).toMatchSnapshot()
    expect(getCursors(badgeMembers.data.members)).toEqual(
      getSortedCursors(badgeMembers.data.members),
    )
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.members)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.getBadgeMembers({
        uri: sc.badges[bob][1].uriStr,
        before: cursor,
        limit: 2,
      })
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.members.length).toBeLessThanOrEqual(2),
    )

    const full = await client.app.bsky.getBadgeMembers({
      uri: sc.badges[bob][1].uriStr,
    })

    expect(full.data.members.length).toEqual(3)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
