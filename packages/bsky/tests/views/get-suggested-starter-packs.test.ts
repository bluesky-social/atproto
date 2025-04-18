import { once } from 'node:events'
import { Server, createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import express, { Application } from 'express'
import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { OutputSchema } from '../../src/lexicon/types/app/bsky/unspecced/getSuggestedStarterPacksSkeleton'
import {
  StarterPacks,
  Users,
  starterPacksSeed,
} from '../seed/get-suggested-starter-packs'

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
    agent = network.bsky.getClient()
    sc = network.getSeedClient()

    const result = await starterPacksSeed(sc)
    users = result.users
    starterpacks = result.starterpacks

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
    await mockServer.stop()
  })

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

  mockedStarterPackUris = new Map<string, OutputSchema['starterPacks'][0]>()

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
    app.get(
      '/xrpc/app.bsky.unspecced.getSuggestedStarterPacksSkeleton',
      (req, res) => {
        const skeleton: OutputSchema = {
          starterPacks: Array.from(this.mockedStarterPackUris.values()),
        }
        return res.json(skeleton)
      },
    )
    return app
  }
}
