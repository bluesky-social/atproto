import AtpAgent, { ComAtprotoAdminSearchRepos } from '@atproto/api'
import { wait } from '@atproto/common'
import { TestNetwork, SeedClient } from '@atproto/dev-env'
import usersBulkSeed from '../../seeds/users-bulk'

describe('pds admin repo search views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let headers: { [s: string]: string }
  // In results that don't have a related profile record, we will only have handle but not a name
  // And names are usually capitalized on each word so the comparison is done on lowercase version
  const handleOrNameStartsWith =
    (term: string) => (handleOrName: (string | undefined)[]) =>
      !!handleOrName.find((str) =>
        str?.toLowerCase().includes(term.toLowerCase()),
      )
  const resultToHandlesAndNames = (
    result: ComAtprotoAdminSearchRepos.Response,
  ) =>
    result.data.repos.map((u: any) => [
      u.handle,
      (u.relatedRecords[0] as Record<string, string | undefined>)?.displayName,
    ])

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_repo_search',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()

    await wait(100) // allow pending sub to be established
    await network.bsky.ingester.sub.destroy()
    await usersBulkSeed(sc)

    // Skip did/handle resolution for expediency
    const db = network.bsky.ctx.db.getPrimary()
    const now = new Date().toISOString()
    await db.db
      .insertInto('actor')
      .values(
        Object.entries(sc.dids).map(([handle, did]) => ({
          did,
          handle,
          indexedAt: now,
        })),
      )
      .onConflict((oc) => oc.doNothing())
      .execute()

    // Process remaining profiles
    network.bsky.ingester.sub.resume()
    await network.processAll(50000)
    headers = await network.adminHeaders({})
  })

  afterAll(async () => {
    await network.close()
  })

  it('gives relevant results when searched by handle', async () => {
    const term = 'car'
    const result = await agent.api.com.atproto.admin.searchRepos(
      { term },
      { headers },
    )

    const shouldContain = [
      // Present despite repo takedown
      // First item in the array because of direct handle match
      'cara-wiegand69.test',
      'carlos6.test',
      'aliya-hodkiewicz.test', // Carlton Abernathy IV
      'eudora-dietrich4.test', // Carol Littel
      'carolina-mcdermott77.test',
      'shane-torphy52.test', // Sadie Carter
      // Last item in the array because handle and display name none match very close to the the search term
      'cayla-marquardt39.test',
    ]

    const handlesAndNames = resultToHandlesAndNames(result)
    const handles = handlesAndNames.map(([handle]) => handle)
    // Assert that all matches are found
    shouldContain.forEach((handle) => expect(handles).toContain(handle))
    // Assert that the order is correct, showing the closest match by handle first
    const containsTerm = handleOrNameStartsWith(term)
    expect(containsTerm(handlesAndNames[0])).toBeTruthy()
    expect(
      containsTerm(handlesAndNames[handlesAndNames.length - 1]),
    ).toBeFalsy()
  })

  it('pagination respects matching order when searched by handle', async () => {
    const term = 'car'
    const resultPageOne = await agent.api.com.atproto.admin.searchRepos(
      { term, limit: 4 },
      { headers },
    )
    const resultPageTwo = await agent.api.com.atproto.admin.searchRepos(
      { term, limit: 4, cursor: resultPageOne.data.cursor },
      { headers },
    )

    const handlesAndNamesPageOne = resultToHandlesAndNames(resultPageOne)
    const handlesAndNamesPageTwo = resultToHandlesAndNames(resultPageTwo)
    const containsTerm = handleOrNameStartsWith(term)

    // First result of first page always has matches either handle or did
    expect(containsTerm(handlesAndNamesPageOne[0])).toBeTruthy()
    // Since we only get 4 items per page max and know that among the test dataset
    // at least 4 users have the term in handle or profile, last item in first page
    // should contain the term
    expect(
      containsTerm(handlesAndNamesPageOne[handlesAndNamesPageOne.length - 1]),
    ).toBeTruthy()
    // However, the last item of second page, should not contain the term
    expect(
      containsTerm(handlesAndNamesPageTwo[handlesAndNamesPageTwo.length - 1]),
    ).toBeFalsy()
  })

  it('gives relevant results when searched by did', async () => {
    const term = sc.dids['cara-wiegand69.test']
    const res = await agent.api.com.atproto.admin.searchRepos(
      { term },
      { headers },
    )

    expect(res.data.repos.length).toEqual(1)
    expect(res.data.repos[0].did).toEqual(term)
  })
})
