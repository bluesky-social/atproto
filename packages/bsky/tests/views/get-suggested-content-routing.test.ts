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
  skeletonMethod: string
  recIdStr: string
  call: (agent: AtpAgent) => Promise<string | undefined>
}

const routes: Route[] = [
  {
    name: 'suggested feeds',
    gate: Gate.SuggestedFeedsV2Enable,
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestedFeedsSkeleton,
    recIdStr: 'suggested-feeds-rec-id',
    call: async (agent) =>
      (await agent.app.bsky.unspecced.getSuggestedFeeds()).data.recIdStr,
  },
  {
    name: 'suggested starter packs',
    gate: Gate.SuggestedStarterPacksV2Enable,
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestedStarterPacksSkeleton,
    recIdStr: 'suggested-starter-packs-rec-id',
    call: async (agent) =>
      (await agent.app.bsky.unspecced.getSuggestedStarterPacks()).data.recIdStr,
  },
  {
    name: 'onboarding suggested starter packs',
    gate: Gate.SuggestedStarterPacksOnboardingV2Enable,
    skeletonMethod:
      ids.AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton,
    recIdStr: 'onboarding-suggested-starter-packs-rec-id',
    call: async (agent) =>
      (await agent.app.bsky.unspecced.getOnboardingSuggestedStarterPacks()).data
        .recIdStr,
  },
]

describe('suggested content routing', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let topicsServer: MockSuggestedContentServer
  let irisServer: MockSuggestedContentServer

  beforeAll(async () => {
    topicsServer = new MockSuggestedContentServer()
    irisServer = new MockSuggestedContentServer()
    await Promise.all([topicsServer.listen(), irisServer.listen()])

    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_suggested_content_routing',
      bsky: {
        topicsUrl: topicsServer.url,
        irisUrl: irisServer.url,
        irisApiKey: IRIS_API_KEY,
      },
    })
    agent = network.bsky.getAgent()
  })

  beforeEach(() => {
    topicsServer.reset()
    irisServer.reset()
  })

  afterAll(async () => {
    await network?.close()
    await Promise.all([topicsServer?.stop(), irisServer?.stop()])
  })

  it.each(routes)(
    '$name calls Topics when its gate is disabled',
    async (route) => {
      using _scope = mockGate()

      await route.call(agent)

      expect(topicsServer.requestCount(route.skeletonMethod)).toBe(1)
      expect(irisServer.requestCount(route.skeletonMethod)).toBe(0)
    },
  )

  it.each(routes)(
    '$name calls Iris when its gate is enabled',
    async (route) => {
      using _scope = mockGate(route.gate)

      const recIdStr = await route.call(agent)

      expect(topicsServer.requestCount(route.skeletonMethod)).toBe(0)
      expect(irisServer.requestCount(route.skeletonMethod)).toBe(1)
      expect(irisServer.authorization(route.skeletonMethod)).toBe(
        `Bearer ${IRIS_API_KEY}`,
      )
      expect(recIdStr).toBe(route.recIdStr)
    },
  )

  it.each(routes)(
    '$name fails when Iris is selected but unavailable',
    async (route) => {
      using _scope = mockGate(route.gate)
      using _irisClient = vi
        .spyOn(network.bsky.ctx, 'irisClient', 'get')
        .mockReturnValue(undefined)

      await expect(route.call(agent)).rejects.toThrow(
        'Iris agent not available',
      )
      expect(topicsServer.requestCount(route.skeletonMethod)).toBe(0)
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
    return app
  }

  private record(method: string, authorization: string | undefined) {
    this.requests.set(method, this.requestCount(method) + 1)
    this.authorizations.set(method, authorization)
  }
}
