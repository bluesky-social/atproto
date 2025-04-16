import assert from 'node:assert'
import { once } from 'node:events'
import { Server, createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import express, { Application } from 'express'
import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { OutputSchema } from '../../src/lexicon/types/app/bsky/unspecced/getTrendsSkeleton'
import { Users, trendsSeed } from '../seed/get-trends'

describe('getTrends', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let users: Users
  let mockTrendServer: MockTrendsServer

  beforeAll(async () => {
    mockTrendServer = new MockTrendsServer()
    await mockTrendServer.listen()

    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_tests_get_trends_test_b',
      bsky: {
        topicsUrl: mockTrendServer.url,
        topicsApiKey: 'test',
      },
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()

    const result = await trendsSeed(sc)
    users = result.users

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
    await mockTrendServer.stop()
  })

  describe(`basic handling`, () => {
    beforeAll(() => {
      mockTrendServer.mockedTrendSkeletons.set('a', {
        topic: 'a',
        displayName: 'A',
        link: '/test',
        startedAt: new Date().toISOString(),
        postCount: 3,
        dids: [users.posterA.did, users.posterB.did, users.posterC.did],
      })
    })

    afterAll(() => {
      mockTrendServer.mockedTrendSkeletons.delete('a')
    })

    it(`returns all users for non-blocked user`, async () => {
      const { data } = await agent.app.bsky.unspecced.getTrends(undefined, {
        headers: await network.serviceHeaders(
          users.viewer.did,
          ids.AppBskyUnspeccedGetTrends,
        ),
      })
      const trendA = data.trends.find((t) => t.topic === 'a')

      assert(trendA)

      expect(trendA.actors.map((a) => a.did)).toEqual([
        users.posterA.did,
        users.posterB.did,
        users.posterC.did,
      ])
    })

    it(`does not return user blocked by viewer`, async () => {
      const { data } = await agent.app.bsky.unspecced.getTrends(undefined, {
        headers: await network.serviceHeaders(
          users.viewerBlocker.did,
          ids.AppBskyUnspeccedGetTrends,
        ),
      })
      const trendA = data.trends.find((t) => t.topic === 'a')

      assert(trendA)

      expect(trendA.actors.map((a) => a.did)).toEqual([
        users.posterA.did,
        users.posterB.did,
      ])
    })
  })
})

class MockTrendsServer {
  app: Application
  server: Server

  mockedTrendSkeletons = new Map<string, OutputSchema['trends'][0]>()

  constructor() {
    this.app = this.createApp()
    this.server = createServer(this.app)
  }

  async listen(port?: number) {
    this.server.listen(port)
    await once(this.server, 'listening')
  }

  async stop() {
    this.server.close()
    await once(this.server, 'close')
  }

  get url() {
    const address = this.server.address() as AddressInfo
    return `http://localhost:${address.port}`
  }

  private createApp() {
    const app = express()
    app.get('/xrpc/app.bsky.unspecced.getTrendsSkeleton', (req, res) => {
      const skeleton: OutputSchema = {
        trends: Array.from(this.mockedTrendSkeletons.values()),
      }
      return res.json(skeleton)
    })
    return app
  }
}
