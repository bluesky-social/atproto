import { once } from 'node:events'
import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import express, { type Application } from 'express'
import { type HttpTerminator, createHttpTerminator } from 'http-terminator'
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
import { TestNetwork } from '@atproto/dev-env'
import { Gate } from '../../src/feature-gates/gates.js'

const IRIS_API_KEY = 'test-iris-api-key'

type Route = {
  name: string
  gate: Gate
  // The legacy backend when the gate is off: Topics for feeds/starter packs,
  // seeemore (suggestionsUrl) for user suggestions. The dedicated user
  // skeletons fall back to the base getSuggestedUsersSkeleton on seeemore.
  legacy: 'topics' | 'suggestions'
  legacyMethod?: string
  // NSID of the app-facing endpoint, for service-auth headers.
  lxm?: string
  skeletonMethod: string
  recIdStr: string
  // getSuggestions falls back to the dataplane and getSuggestedFollowsByActor
  // returns an empty list when the gated client is missing; the rest 501.
  onIrisUnavailable: 'throws' | 'fallback' | 'empty'
  call: (
    agent: AtpAgent,
    headers?: Record<string, string>,
  ) => Promise<string | undefined>
}

const routes: Route[] = [
  {
    name: 'suggested feeds',
    gate: Gate.SuggestedFeedsV2Enable,
    legacy: 'topics',
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestedFeedsSkeleton,
    recIdStr: 'suggested-feeds-rec-id',
    onIrisUnavailable: 'throws',
    call: async (agent) =>
      (await agent.app.bsky.unspecced.getSuggestedFeeds()).data.recIdStr,
  },
  {
    name: 'suggested starter packs',
    gate: Gate.SuggestedStarterPacksV2Enable,
    legacy: 'topics',
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestedStarterPacksSkeleton,
    recIdStr: 'suggested-starter-packs-rec-id',
    onIrisUnavailable: 'throws',
    call: async (agent) =>
      (await agent.app.bsky.unspecced.getSuggestedStarterPacks()).data.recIdStr,
  },
  {
    name: 'onboarding suggested starter packs',
    gate: Gate.SuggestedStarterPacksOnboardingV2Enable,
    legacy: 'topics',
    skeletonMethod:
      ids.AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton,
    recIdStr: 'onboarding-suggested-starter-packs-rec-id',
    onIrisUnavailable: 'throws',
    call: async (agent) =>
      (await agent.app.bsky.unspecced.getOnboardingSuggestedStarterPacks()).data
        .recIdStr,
  },
  {
    name: 'suggested users',
    gate: Gate.SuggestedUsersIrisEnable,
    legacy: 'topics',
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestedUsersSkeleton,
    recIdStr: 'suggested-users-rec-id',
    onIrisUnavailable: 'throws',
    call: async (agent) =>
      (await agent.app.bsky.unspecced.getSuggestedUsers()).data.recIdStr,
  },
  {
    name: 'suggested users for discover',
    gate: Gate.SuggestedUsersIrisEnable,
    legacy: 'suggestions',
    legacyMethod: ids.AppBskyUnspeccedGetSuggestedUsersSkeleton,
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestedUsersForDiscoverSkeleton,
    recIdStr: 'suggested-users-discover-rec-id',
    onIrisUnavailable: 'throws',
    call: async (agent) =>
      (await agent.app.bsky.unspecced.getSuggestedUsersForDiscover()).data
        .recIdStr,
  },
  {
    name: 'suggested users for explore',
    gate: Gate.SuggestedUsersIrisEnable,
    legacy: 'suggestions',
    legacyMethod: ids.AppBskyUnspeccedGetSuggestedUsersSkeleton,
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestedUsersForExploreSkeleton,
    recIdStr: 'suggested-users-explore-rec-id',
    onIrisUnavailable: 'throws',
    call: async (agent) =>
      (await agent.app.bsky.unspecced.getSuggestedUsersForExplore()).data
        .recIdStr,
  },
  {
    name: 'suggested users for see more',
    gate: Gate.SuggestedUsersIrisEnable,
    legacy: 'suggestions',
    legacyMethod: ids.AppBskyUnspeccedGetSuggestedUsersSkeleton,
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestedUsersForSeeMoreSkeleton,
    recIdStr: 'suggested-users-seemore-rec-id',
    onIrisUnavailable: 'throws',
    call: async (agent) =>
      (await agent.app.bsky.unspecced.getSuggestedUsersForSeeMore()).data
        .recIdStr,
  },
  {
    name: 'onboarding suggested users',
    gate: Gate.SuggestedUsersIrisEnable,
    legacy: 'suggestions',
    skeletonMethod: ids.AppBskyUnspeccedGetOnboardingSuggestedUsersSkeleton,
    recIdStr: 'onboarding-users-rec-id',
    onIrisUnavailable: 'throws',
    call: async (agent) =>
      (await agent.app.bsky.unspecced.getSuggestedOnboardingUsers()).data
        .recIdStr,
  },
  {
    name: 'actor suggestions',
    gate: Gate.SuggestedUsersIrisEnable,
    legacy: 'suggestions',
    lxm: ids.AppBskyActorGetSuggestions,
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestionsSkeleton,
    recIdStr: 'suggestions-rec-id',
    onIrisUnavailable: 'fallback',
    call: async (agent, headers) =>
      (await agent.app.bsky.actor.getSuggestions({}, { headers })).data
        .recIdStr,
  },
  {
    name: 'suggested follows by actor',
    gate: Gate.SuggestedUsersIrisEnable,
    legacy: 'suggestions',
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestionsSkeleton,
    recIdStr: 'suggestions-rec-id',
    onIrisUnavailable: 'empty',
    call: async (agent) =>
      (
        await agent.app.bsky.graph.getSuggestedFollowsByActor({
          actor: 'alice.test',
        })
      ).data.recIdStr,
  },
]

describe('suggested content routing', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let topicsServer: MockSuggestedContentServer
  let suggestionsServer: MockSuggestedContentServer
  let irisServer: MockSuggestedContentServer
  let aliceDid: string

  beforeAll(async () => {
    topicsServer = new MockSuggestedContentServer()
    suggestionsServer = new MockSuggestedContentServer()
    irisServer = new MockSuggestedContentServer()
    await Promise.all([
      topicsServer.listen(),
      suggestionsServer.listen(),
      irisServer.listen(),
    ])

    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_suggested_content_routing',
      bsky: {
        topicsUrl: topicsServer.url,
        suggestionsUrl: suggestionsServer.url,
        irisUrl: irisServer.url,
        irisApiKey: IRIS_API_KEY,
      },
    })
    agent = network.bsky.getAgent()

    // getSuggestions only calls the skeleton service for an authed viewer, and
    // getSuggestedFollowsByActor needs a resolvable actor.
    const sc = network.getSeedClient()
    await sc.createAccount('alice', {
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice-pass',
    })
    await network.processAll()
    aliceDid = sc.dids.alice
  })

  beforeEach(() => {
    topicsServer.reset()
    suggestionsServer.reset()
    irisServer.reset()
  })

  afterAll(async () => {
    await network?.close()
    await Promise.all([
      topicsServer?.stop(),
      suggestionsServer?.stop(),
      irisServer?.stop(),
    ])
  })

  const legacyServer = (route: Route) =>
    route.legacy === 'topics' ? topicsServer : suggestionsServer

  const headers = async (route: Route) =>
    route.lxm ? await network.serviceHeaders(aliceDid, route.lxm) : undefined

  it.each(routes)(
    '$name calls the legacy backend when its gate is disabled',
    async (route) => {
      using _scope = mockGate()

      await route.call(agent, await headers(route))

      expect(
        legacyServer(route).requestCount(
          route.legacyMethod ?? route.skeletonMethod,
        ),
      ).toBe(1)
      expect(irisServer.requestCount(route.skeletonMethod)).toBe(0)
    },
  )

  it.each(routes)(
    '$name calls Iris when its gate is enabled',
    async (route) => {
      using _scope = mockGate(route.gate)

      const recIdStr = await route.call(agent, await headers(route))

      expect(
        legacyServer(route).requestCount(
          route.legacyMethod ?? route.skeletonMethod,
        ),
      ).toBe(0)
      expect(irisServer.requestCount(route.skeletonMethod)).toBe(1)
      expect(irisServer.authorization(route.skeletonMethod)).toBe(
        `Bearer ${IRIS_API_KEY}`,
      )
      expect(recIdStr).toBe(route.recIdStr)
    },
  )

  it.each(routes)(
    '$name handles Iris being selected but unavailable',
    async (route) => {
      using _scope = mockGate(route.gate)
      using _irisClient = vi
        .spyOn(network.bsky.ctx, 'irisClient', 'get')
        .mockReturnValue(undefined)

      if (route.onIrisUnavailable === 'throws') {
        await expect(route.call(agent, await headers(route))).rejects.toThrow(
          'Iris agent not available',
        )
      } else {
        // getSuggestions falls back to the dataplane; getSuggestedFollowsByActor
        // returns an empty list.
        await route.call(agent, await headers(route))
      }
      expect(legacyServer(route).requestCount(route.skeletonMethod)).toBe(0)
      expect(irisServer.requestCount(route.skeletonMethod)).toBe(0)
    },
  )

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

class MockSuggestedContentServer {
  app: Application
  server: Server
  terminator: HttpTerminator
  requests = new Map<string, number>()
  authorizations = new Map<string, string | undefined>()

  constructor() {
    this.app = this.createApp()
    this.server = createServer(this.app)
    this.terminator = createHttpTerminator({ server: this.server })
  }

  async listen() {
    this.server.listen()
    await once(this.server, 'listening')
  }

  async stop() {
    await this.terminator.terminate()
  }

  async [Symbol.asyncDispose]() {
    await this.stop()
  }

  reset() {
    this.requests.clear()
    this.authorizations.clear()
  }

  requestCount(method: string) {
    return this.requests.get(method) ?? 0
  }

  authorization(method: string) {
    return this.authorizations.get(method)
  }

  get url() {
    const address = this.server.address() as AddressInfo
    return `http://localhost:${address.port}`
  }

  private createApp() {
    const app = express()
    app.get(
      `/xrpc/${ids.AppBskyUnspeccedGetSuggestedFeedsSkeleton}`,
      (req, res) => {
        this.record(
          ids.AppBskyUnspeccedGetSuggestedFeedsSkeleton,
          req.headers.authorization,
        )
        return res.json({ feeds: [], recIdStr: 'suggested-feeds-rec-id' })
      },
    )
    app.get(
      `/xrpc/${ids.AppBskyUnspeccedGetSuggestedStarterPacksSkeleton}`,
      (req, res) => {
        this.record(
          ids.AppBskyUnspeccedGetSuggestedStarterPacksSkeleton,
          req.headers.authorization,
        )
        return res.json({
          starterPacks: [],
          recIdStr: 'suggested-starter-packs-rec-id',
        })
      },
    )
    app.get(
      `/xrpc/${ids.AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton}`,
      (req, res) => {
        this.record(
          ids.AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton,
          req.headers.authorization,
        )
        return res.json({
          starterPacks: [],
          recIdStr: 'onboarding-suggested-starter-packs-rec-id',
        })
      },
    )
    const userSuggestionRoutes: [string, Record<string, unknown>][] = [
      [
        ids.AppBskyUnspeccedGetSuggestedUsersSkeleton,
        { dids: [], recIdStr: 'suggested-users-rec-id' },
      ],
      [
        ids.AppBskyUnspeccedGetSuggestedUsersForDiscoverSkeleton,
        { dids: [], recIdStr: 'suggested-users-discover-rec-id' },
      ],
      [
        ids.AppBskyUnspeccedGetSuggestedUsersForExploreSkeleton,
        { dids: [], recIdStr: 'suggested-users-explore-rec-id' },
      ],
      [
        ids.AppBskyUnspeccedGetSuggestedUsersForSeeMoreSkeleton,
        { dids: [], recIdStr: 'suggested-users-seemore-rec-id' },
      ],
      [
        ids.AppBskyUnspeccedGetOnboardingSuggestedUsersSkeleton,
        { dids: [], recIdStr: 'onboarding-users-rec-id' },
      ],
      [
        ids.AppBskyUnspeccedGetSuggestionsSkeleton,
        { actors: [], recIdStr: 'suggestions-rec-id' },
      ],
    ]
    for (const [method, body] of userSuggestionRoutes) {
      app.get(`/xrpc/${method}`, (req, res) => {
        this.record(method, req.headers.authorization)
        return res.json(body)
      })
    }
    return app
  }

  private record(method: string, authorization: string | undefined) {
    this.requests.set(method, this.requestCount(method) + 1)
    this.authorizations.set(method, authorization)
  }
}
