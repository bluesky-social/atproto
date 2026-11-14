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

describe('actor typeahead from a typeahead service', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let typeahead: AsyncDisposable & { port: number }
  let requests: (SearchTypeaheadParams | undefined)[]
  let respond: () => string[]

  beforeAll(async () => {
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
  })

  it.each([
    { name: 'disabled', gate: undefined },
    { name: 'enabled', gate: Gate.SearchV2Enable },
  ])(
    'serves the skeleton from the typeahead service with SearchV2Enable $name',
    async ({ gate }) => {
      using _gate = mockGate(gate)
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

  it('returns a 400 when the typeahead service rejects the query', async () => {
    respond = () => {
      throw new ConnectError('bad query', Code.InvalidArgument)
    }

    await expect(
      agent.app.bsky.actor.searchActorsTypeahead({ q: 'b' }),
    ).rejects.toMatchObject({ status: 400, error: 'InvalidRequest' })
  })

  it('does not fall back to the dataplane when the typeahead service fails', async () => {
    using _gate = mockGate(Gate.SearchV2Enable)
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
    {
      name: 'enabled',
      gate: Gate.SearchV2Enable,
      method: 'searchActorsTypeahead',
    },
    { name: 'disabled', gate: undefined, method: 'searchActors' },
  ] as const)(
    'calls the dataplane when no typeahead service is configured, with SearchV2Enable $name',
    async ({ gate, method }) => {
      using _gate = mockGate(gate)
      using _client = vi
        .spyOn(network.bsky.ctx, 'typeaheadClient', 'get')
        .mockReturnValue(undefined)
      using dataplane = spyDataplane()

      await agent.app.bsky.actor.searchActorsTypeahead({ q: 'b' })

      expect(dataplane[method]).toHaveBeenCalledOnce()
      expect(requests).toEqual([])
    },
  )

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

  function mockGate(enabled?: Gate) {
    return vi
      .spyOn(network.bsky.ctx.featureGatesClient, 'scope')
      .mockImplementation(() => ({
        Gate,
        checkGate: (gate) => gate === enabled,
        checkGates: (gates) =>
          new Map(gates.map((gate) => [gate, gate === enabled])),
      }))
  }
})
