import { once } from 'node:events'
import { Server, createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import express, { Application } from 'express'
import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { OutputSchema } from '../../src/lexicon/types/app/bsky/unspecced/getSuggestedUsersSkeleton'

type User = {
  id: string
  did: string
  email: string
  handle: string
  password: string
  displayName: string
  description: string
  selfLabels: undefined
}

function createUser(name: string): User {
  return {
    id: name,
    // @ts-ignore overwritten below
    did: undefined,
    email: `${name}@test.com`,
    handle: `${name}.test`,
    password: `${name}-pass`,
    displayName: name,
    description: `hi im ${name}`,
    selfLabels: undefined,
  }
}

const users = {
  suggestedUser: createUser('suggested-user'),
  viewer: createUser('viewer'),
  viewerBlocker: createUser('viewer-blocker'),
  followedUser: createUser('followed-user'),
}

type Users = typeof users

async function seed(sc: SeedClient) {
  const u = structuredClone(users)

  for (const [key, user] of Object.entries(u)) {
    await sc.createAccount(key, user)
    u[key].did = sc.dids[key]
  }

  await sc.block(u.viewerBlocker.did, u.suggestedUser.did)
  await sc.follow(u.viewer.did, u.followedUser.did)

  await sc.network.processAll()

  return { users: u }
}

describe('getSuggestedOnboardingUsers', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let seededUsers: Users
  let mockServer: MockServer

  beforeAll(async () => {
    mockServer = new MockServer()
    await mockServer.listen()

    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_tests_get_suggested_onboarding_users',
      bsky: {
        topicsUrl: mockServer.url,
        topicsApiKey: 'test',
      },
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()

    const result = await seed(sc)
    seededUsers = result.users

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
    await mockServer.stop()
  })

  describe(`basic handling`, () => {
    beforeAll(() => {
      mockServer.mockedDids.set('suggestedUser', seededUsers.suggestedUser.did)
    })

    afterAll(() => {
      mockServer.mockedDids.delete('suggestedUser')
    })

    it(`returns users for non-blocking viewer`, async () => {
      const { data } =
        await agent.app.bsky.unspecced.getSuggestedOnboardingUsers(undefined, {
          headers: await network.serviceHeaders(
            seededUsers.viewer.did,
            ids.AppBskyUnspeccedGetSuggestedOnboardingUsers,
          ),
        })
      const actor = data.actors.find(
        (a) => a.did === seededUsers.suggestedUser.did,
      )
      expect(actor).toBeDefined()
    })

    it(`does not return user if blocked by viewer`, async () => {
      const { data } =
        await agent.app.bsky.unspecced.getSuggestedOnboardingUsers(undefined, {
          headers: await network.serviceHeaders(
            seededUsers.viewerBlocker.did,
            ids.AppBskyUnspeccedGetSuggestedOnboardingUsers,
          ),
        })
      const actor = data.actors.find(
        (a) => a.did === seededUsers.suggestedUser.did,
      )
      expect(actor).not.toBeDefined()
    })

    it(`does not return users that viewer already follows`, async () => {
      mockServer.mockedDids.set('followedUser', seededUsers.followedUser.did)
      const { data } =
        await agent.app.bsky.unspecced.getSuggestedOnboardingUsers(undefined, {
          headers: await network.serviceHeaders(
            seededUsers.viewer.did,
            ids.AppBskyUnspeccedGetSuggestedOnboardingUsers,
          ),
        })
      const actor = data.actors.find(
        (a) => a.did === seededUsers.followedUser.did,
      )
      expect(actor).not.toBeDefined()
      mockServer.mockedDids.delete('followedUser')
    })
  })
})

class MockServer {
  app: Application
  server: Server

  mockedDids = new Map<string, string>()

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
      '/xrpc/app.bsky.unspecced.getSuggestedUsersSkeleton',
      (req, res) => {
        const skeleton: OutputSchema = {
          dids: Array.from(this.mockedDids.values()),
        }
        return res.json(skeleton)
      },
    )
    return app
  }
}
