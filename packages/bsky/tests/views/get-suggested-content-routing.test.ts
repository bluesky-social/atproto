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

type Route = {
  name: string
  gate: Gate
  skeletonMethod: string
  call: (agent: AtpAgent) => Promise<unknown>
}

const routes: Route[] = [
  {
    name: 'suggested feeds',
    gate: Gate.SuggestedFeedsV2Enable,
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestedFeedsSkeleton,
    call: (agent) => agent.app.bsky.unspecced.getSuggestedFeeds(),
  },
  {
    name: 'suggested starter packs',
    gate: Gate.SuggestedStarterPacksV2Enable,
    skeletonMethod: ids.AppBskyUnspeccedGetSuggestedStarterPacksSkeleton,
    call: (agent) => agent.app.bsky.unspecced.getSuggestedStarterPacks(),
  },
  {
    name: 'onboarding suggested starter packs',
    gate: Gate.SuggestedStarterPacksOnboardingV2Enable,
    skeletonMethod:
      ids.AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton,
    call: (agent) =>
      agent.app.bsky.unspecced.getOnboardingSuggestedStarterPacks(),
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

      await route.call(agent)

      expect(topicsServer.requestCount(route.skeletonMethod)).toBe(0)
      expect(irisServer.requestCount(route.skeletonMethod)).toBe(1)
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
  }

  requestCount(method: string) {
    return this.requests.get(method) ?? 0
  }

  get url() {
    const address = this.server.address() as AddressInfo
    return `http://localhost:${address.port}`
  }

  private createApp() {
    const app = express()
    app.get(
      `/xrpc/${ids.AppBskyUnspeccedGetSuggestedFeedsSkeleton}`,
      (_req, res) => {
        this.record(ids.AppBskyUnspeccedGetSuggestedFeedsSkeleton)
        return res.json({ feeds: [] })
      },
    )
    app.get(
      `/xrpc/${ids.AppBskyUnspeccedGetSuggestedStarterPacksSkeleton}`,
      (_req, res) => {
        this.record(ids.AppBskyUnspeccedGetSuggestedStarterPacksSkeleton)
        return res.json({ starterPacks: [] })
      },
    )
    app.get(
      `/xrpc/${ids.AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton}`,
      (_req, res) => {
        this.record(
          ids.AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton,
        )
        return res.json({ starterPacks: [] })
      },
    )
    return app
  }

  private record(method: string) {
    this.requests.set(method, this.requestCount(method) + 1)
  }
}
