import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Code, ConnectError } from '@connectrpc/connect'
import { connectNodeAdapter } from '@connectrpc/connect-node'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { type AtpAgent, ids } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { Gate } from '../../src/feature-gates/gates.js'
import { Service } from '../../src/proto/bsky_connect.js'
import type { SearchTypeaheadParams } from '../../src/proto/bsky_pb.js'
import { startServer } from '../_util.js'

const UNKNOWN_DID = 'did:plc:unknownactorxxxxxxxxxxxx'

const PROHIBITED_TERMS_CSV = `\
ID,Date Requested,Value (Term / Hashtag),Match Type,Enforcement Outcome,Surface,Intervention,Priority,Implementation,Effective Start Date,Effective End Date,Date Completed,Status
1,2026-01-01,blockedterm,Exact,Block (Zero Results),Search Results - All,,P1,,2026-01-01,,,Completed
`

describe('actor typeahead from a typeahead service', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let typeahead: AsyncDisposable & { port: number }
  let requests: (SearchTypeaheadParams | undefined)[]
  let respond: () => string[]
  let termsDir: string

  beforeAll(async () => {
    termsDir = await mkdtemp(join(tmpdir(), 'typeahead-terms-'))
    const termsFile = join(termsDir, 'prohibited_terms.csv')
    await writeFile(termsFile, PROHIBITED_TERMS_CSV)
    typeahead = await startServer(
      connectNodeAdapter({
        routes: (router) =>
          router.service(Service, {
            searchActorsTypeahead: (req) => {
              requests.push(req.params)
              return { actors: respond().map((did) => ({ did, score: 1 })) }
            },
          }),
      }),
    )
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_actor_search_typeahead',
      bsky: {
        typeaheadUrls: [`http://localhost:${typeahead.port}`],
        typeaheadProhibitedTermsFile: termsFile,
      },
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  beforeEach(() => {
    requests = []
    respond = () => [sc.dids.bob, UNKNOWN_DID, sc.dids.alice]
  })

  afterAll(async () => {
    await network?.close()
    await typeahead?.[Symbol.asyncDispose]()
    if (termsDir) await rm(termsDir, { recursive: true, force: true })
  })

  it.each([
    { name: 'disabled', gates: [] },
    { name: 'enabled', gates: [Gate.SearchV2Enable] },
  ])(
    'serves the skeleton from the typeahead service with SearchV2Enable $name',
    async ({ gates }) => {
      using _gates = mockGates(Gate.TypeaheadServiceEnable, ...gates)
      using dataplane = spyDataplane()

      const { data } = await agent.app.bsky.actor.searchActorsTypeahead(
        { q: 'b', limit: 5 },
        { headers: await viewerHeaders() },
      )

      expect(data.actors.map((a) => [a.did, a.handle])).toEqual([
        [sc.dids.bob, 'bob.test'],
        [sc.dids.alice, 'alice.test'],
      ])
      expect(requests).toEqual([
        expect.objectContaining({
          query: 'b',
          viewer: sc.dids.carol,
          limit: 5,
        }),
      ])
      expect(dataplane.searchActorsTypeahead).not.toHaveBeenCalled()
      expect(dataplane.searchActors).not.toHaveBeenCalled()
    },
  )

  it('returns no actors for a prohibited query without calling the typeahead service', async () => {
    using _gates = mockGates(Gate.TypeaheadServiceEnable)
    using dataplane = spyDataplane()

    const { data } = await agent.app.bsky.actor.searchActorsTypeahead({
      q: '@BlockedTerm',
    })

    expect(data.actors).toEqual([])
    expect(requests).toEqual([])
    expect(dataplane.searchActorsTypeahead).not.toHaveBeenCalled()
    expect(dataplane.searchActors).not.toHaveBeenCalled()
  })

  it('returns a 400 when the typeahead service rejects the query', async () => {
    using _gates = mockGates(Gate.TypeaheadServiceEnable)
    respond = () => {
      throw new ConnectError('bad query', Code.InvalidArgument)
    }

    await expect(
      agent.app.bsky.actor.searchActorsTypeahead({ q: 'b' }),
    ).rejects.toMatchObject({ status: 400, error: 'InvalidRequest' })
  })

  it('does not fall back to the dataplane when the typeahead service fails', async () => {
    using _gates = mockGates(Gate.TypeaheadServiceEnable, Gate.SearchV2Enable)
    using dataplane = spyDataplane()
    respond = () => {
      throw new ConnectError('overloaded', Code.Unavailable)
    }

    await expect(
      agent.app.bsky.actor.searchActorsTypeahead({ q: 'b' }),
    ).rejects.toMatchObject({ status: 500 })
    expect(requests.length).toBeGreaterThan(0)
    expect(dataplane.searchActorsTypeahead).not.toHaveBeenCalled()
    expect(dataplane.searchActors).not.toHaveBeenCalled()
  })

  it.each([
    { service: 'configured, gate off', configured: true, v2: true },
    { service: 'configured, gate off', configured: true, v2: false },
    { service: 'not configured, gate on', configured: false, v2: true },
    { service: 'not configured, gate on', configured: false, v2: false },
  ])(
    'uses the dataplane with the typeahead service $service and SearchV2Enable $v2',
    async ({ configured, v2 }) => {
      using _gates = mockGates(
        ...(configured ? [] : [Gate.TypeaheadServiceEnable]),
        ...(v2 ? [Gate.SearchV2Enable] : []),
      )
      using _client = configured
        ? undefined
        : vi
            .spyOn(network.bsky.ctx, 'typeaheadClient', 'get')
            .mockReturnValue(undefined)
      using dataplane = spyDataplane()

      // The dataplane applies prohibited terms itself, so they aren't checked here.
      await agent.app.bsky.actor.searchActorsTypeahead({ q: 'blockedterm' })

      expect(
        v2 ? dataplane.searchActorsTypeahead : dataplane.searchActors,
      ).toHaveBeenCalledOnce()
      expect(requests).toEqual([])
    },
  )

  it('uses the dataplane when feature gates are unavailable', async () => {
    using dataplane = spyDataplane()

    // No GrowthBook in tests: every gate is off, as during an outage.
    await agent.app.bsky.actor.searchActorsTypeahead({ q: 'b' })

    expect(dataplane.searchActors).toHaveBeenCalledOnce()
    expect(requests).toEqual([])
  })

  async function viewerHeaders() {
    return network.serviceHeaders(
      sc.dids.carol,
      ids.AppBskyActorSearchActorsTypeahead,
    )
  }

  function spyDataplane() {
    const { dataplane } = network.bsky.ctx
    const spies = {
      searchActorsTypeahead: vi.spyOn(dataplane, 'searchActorsTypeahead'),
      searchActors: vi.spyOn(dataplane, 'searchActors'),
    }
    return {
      ...spies,
      [Symbol.dispose]: () => {
        spies.searchActorsTypeahead.mockRestore()
        spies.searchActors.mockRestore()
      },
    }
  }

  function mockGates(...enabled: Gate[]) {
    return vi
      .spyOn(network.bsky.ctx.featureGatesClient, 'scope')
      .mockImplementation(() => ({
        Gate,
        checkGate: (gate) => enabled.includes(gate),
        checkGates: (gates) =>
          new Map(gates.map((gate) => [gate, enabled.includes(gate)])),
      }))
  }
})
