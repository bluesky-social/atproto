import { once } from 'node:events'
import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import express, { type Application } from 'express'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type AppBskyUnspeccedGetSuggestedStarterPacksSkeleton,
  type AtpAgent,
  ids,
} from '@atproto/api'
import { type SeedClient, TestNetwork } from '@atproto/dev-env'
import {
  type StarterPacks,
  type Users,
  starterPacksSeed,
} from '../seed/get-suggested-starter-packs.js'

describe('getSuggestedStarterPacks', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let users: Users
  let mockServer: MockServer
  let starterpacks: StarterPacks

  beforeAll(async () => {
    mockServer = new MockServer()
    await mockServer.listen()

    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_tests_get_suggested_starter_packs',
      bsky: {
        topicsUrl: mockServer.url,
        topicsApiKey: 'test',
      },
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()

    const result = await starterPacksSeed(sc)
    users = result.users
    starterpacks = result.starterpacks
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())
  afterAll(async () => mockServer?.stop())

  describe(`basic handling`, () => {
    beforeAll(() => {
      const pack = Object.values(starterpacks[users.creator.did])[0]
      mockServer.mockedStarterPackUris.set('a', pack.ref.uriStr)
    })

    afterAll(() => {
      mockServer.mockedStarterPackUris.delete('a')
    })

    it(`returns pack for non-blocking user`, async () => {
      const { data } = await agent.app.bsky.unspecced.getSuggestedStarterPacks(
        undefined,
        {
          headers: await network.serviceHeaders(
            users.viewer.did,
            ids.AppBskyUnspeccedGetSuggestedStarterPacks,
          ),
        },
      )
      const sp = data.starterPacks[0]
      expect(sp).toBeDefined()
    })

    it(`does not return pack if creator blocked by viewer`, async () => {
      const { data } = await agent.app.bsky.unspecced.getSuggestedStarterPacks(
        undefined,
        {
          headers: await network.serviceHeaders(
            users.viewerBlocker.did,
            ids.AppBskyUnspeccedGetSuggestedStarterPacks,
          ),
        },
      )
      const sp = data.starterPacks[0]
      expect(sp).not.toBeDefined()
    })
  })
})

class MockServer {
  app: Application
  server: Server
  terminator: httpTerminator.HttpTerminator

  mockedStarterPackUris = new Map<
    string,
    AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.OutputSchema['starterPacks'][0]
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

  get url() {
    const address = this.server.address() as AddressInfo
    return `http://localhost:${address.port}`
  }

  private createApp() {
    const app = express()
    app.get(
      '/xrpc/app.bsky.unspecced.getSuggestedStarterPacksSkeleton',
      (req, res) => {
        const skeleton: AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.OutputSchema =
          {
            starterPacks: Array.from(this.mockedStarterPackUris.values()),
          }
        return res.json(skeleton)
      },
    )
    return app
  }
}
