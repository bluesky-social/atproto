import assert from 'node:assert'
import { once } from 'node:events'
import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import express, { type Application } from 'express'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type AppBskyUnspeccedGetTrendsSkeleton,
  type AtpAgent,
  ids,
} from '@atproto/api'
import { type SeedClient, TestNetwork } from '@atproto/dev-env'
import { type Users, trendsSeed } from '../seed/get-trends.js'

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
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()

    const result = await trendsSeed(sc)
    users = result.users
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())
  afterAll(async () => mockTrendServer?.stop())

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
  terminator: httpTerminator.HttpTerminator

  mockedTrendSkeletons = new Map<
    string,
    AppBskyUnspeccedGetTrendsSkeleton.OutputSchema['trends'][0]
  >()

  constructor() {
    this.app = this.createApp()
    this.server = createServer(this.app)
    this.terminator = httpTerminator.createHttpTerminator({
      server: this.server,
    })
  }

  async listen(port?: number) {
    this.server.listen(port)
    await once(this.server, 'listening')
  }

  async stop() {
    await this.terminator.terminate()
  }

  async [Symbol.asyncDispose]() {
    await this.stop()
  }

  get url() {
    const address = this.server.address() as AddressInfo
    return `http://localhost:${address.port}`
  }

  private createApp() {
    const app = express()
    app.get('/xrpc/app.bsky.unspecced.getTrendsSkeleton', (req, res) => {
      const skeleton: AppBskyUnspeccedGetTrendsSkeleton.OutputSchema = {
        trends: Array.from(this.mockedTrendSkeletons.values()),
      }
      return res.json(skeleton)
    })
    return app
  }
}
