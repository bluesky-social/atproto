import { AtpAgent } from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  usersBulkSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { OutputSchema as SearchReposOutputSchema } from '../src/lexicon/types/tools/ozone/moderation/searchRepos'
import { paginateAll } from './_util'

describe('admin repo search view', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient
  let headers: { [s: string]: string }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_admin_repo_search',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await usersBulkSeed(sc)
    headers = await network.ozone.modHeaders(
      ids.ToolsOzoneModerationSearchRepos,
    )
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  beforeAll(async () => {
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids['cara-wiegand69.test'],
      },
    })
    await network.ozone.processAll()
  })

  it('gives relevant results', async () => {
    const result = await agent.api.tools.ozone.moderation.searchRepos(
      { term: 'car' },
      { headers },
    )

    const handles = result.data.repos.map((u) => u.handle)

    const shouldContain = [
      'cara-wiegand69.test', // Present despite repo takedown
      'carlos6.test',
      'carolina-mcderm77.test',
    ]

    shouldContain.forEach((handle) => expect(handles).toContain(handle))

    const shouldNotContain = [
      'sven70.test',
      'hilario84.test',
      'santa-hermann78.test',
      'dylan61.test',
      'preston-harris.test',
      'loyce95.test',
      'melyna-zboncak.test',
    ]

    shouldNotContain.forEach((handle) => expect(handles).not.toContain(handle))
  })

  it('finds repo by did', async () => {
    const term = sc.dids['cara-wiegand69.test']
    const res = await agent.api.tools.ozone.moderation.searchRepos(
      { term },
      { headers },
    )

    expect(res.data.repos.length).toEqual(1)
    expect(res.data.repos[0].did).toEqual(term)
  })

  it('paginates with term', async () => {
    const results = (results: SearchReposOutputSchema[]) =>
      results.flatMap((res) => res.repos)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.tools.ozone.moderation.searchRepos(
        { term: 'p', cursor, limit: 3 },
        { headers },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.repos.length).toBeLessThanOrEqual(3),
    )

    const full = await agent.api.tools.ozone.moderation.searchRepos(
      { term: 'p' },
      { headers },
    )

    expect(full.data.repos.length).toBeGreaterThan(3)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('paginates without term', async () => {
    const results = (results: SearchReposOutputSchema[]) =>
      results.flatMap((res) => res.repos)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.tools.ozone.moderation.searchRepos(
        { cursor, limit: 3 },
        { headers },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator, 5)
    paginatedAll.forEach((res) =>
      expect(res.repos.length).toBeLessThanOrEqual(3),
    )

    const full = await agent.api.tools.ozone.moderation.searchRepos(
      { limit: 15 },
      { headers },
    )

    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
