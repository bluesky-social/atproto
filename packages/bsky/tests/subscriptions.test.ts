import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import express from 'express'
import http from 'node:http'
import { once } from 'node:events'
import { Entitlement, GetSubscriberResponse } from '../src/subscriptions'

describe('subscriptions views', () => {
  let network: TestNetwork
  let sc: SeedClient
  let revenueCatServer: http.Server
  let revenueCatHandler: jest.Mock
  let bskyUrl: string

  // account dids, for convenience
  let alice: string

  const TEN_MINUTES = 600_000
  const entitlementValid: Entitlement = {
    expires_date: new Date(Date.now() + TEN_MINUTES).toISOString(),
  }
  const entitlementExpired: Entitlement = {
    expires_date: new Date(Date.now() - TEN_MINUTES).toISOString(),
  }

  beforeAll(async () => {
    const revenueCatPort = 48567

    revenueCatHandler = jest.fn()
    revenueCatServer = await createMockRevenueCatService(
      revenueCatPort,
      revenueCatHandler,
    )

    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_subscriptions',
      bsky: {
        revenueCatV1ApiKey: 'any-key',
        revenueCatV1Url: `http://localhost:${revenueCatPort}`,
      },
    })
    bskyUrl = `http://localhost:${network.bsky.port}`
    network.plc.getClient().updateData
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
    revenueCatServer.close()
    await once(revenueCatServer, 'close')
  })

  describe('webhook handler', () => {
    const createdAt = new Date().toISOString()
    const updatedAt = new Date().toISOString()

    it('sets valid entitlements cache from the API response, excluding expired', async () => {
      await network.bsky.db.db
        .insertInto('subscription_entitlement')
        .values({
          did: alice,
          entitlements: JSON.stringify(['entitlement0']),
          createdAt,
          updatedAt,
        })
        .execute()

      expect(
        getUserSubscriptionEntitlement(network, alice),
      ).resolves.toStrictEqual({
        did: alice,
        entitlements: ['entitlement0'],
        createdAt,
        updatedAt,
      })

      revenueCatHandler.mockImplementation((req, res) => {
        const response: GetSubscriberResponse = {
          subscriber: {
            entitlements: {
              entitlementValid,
              entitlementExpired,
            },
          },
        }
        res.json(response)
      })

      await fetch(`${bskyUrl}/webhooks/revenuecat`, {
        method: 'POST',
        body: JSON.stringify({ event: { app_user_id: alice } }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      expect(
        getUserSubscriptionEntitlement(network, alice),
      ).resolves.toStrictEqual({
        did: alice,
        entitlements: ['entitlementValid'],
        createdAt,
        updatedAt: expect.any(String),
      })
    })

    it('sets empty array in the cache if no valid entitlements are present', async () => {
      revenueCatHandler.mockImplementation((req, res) => {
        const response: GetSubscriberResponse = {
          subscriber: {
            entitlements: { entitlementExpired },
          },
        }
        res.json(response)
      })

      await fetch(`${bskyUrl}/webhooks/revenuecat`, {
        method: 'POST',
        body: JSON.stringify({ event: { app_user_id: alice } }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      expect(
        getUserSubscriptionEntitlement(network, alice),
      ).resolves.toStrictEqual({
        did: alice,
        entitlements: [],
        createdAt,
        updatedAt: expect.any(String),
      })
    })

    it('sets empty array in the cache if no entitlements are present at all', async () => {
      revenueCatHandler.mockImplementation((req, res) => {
        const response: GetSubscriberResponse = {
          subscriber: {
            entitlements: {},
          },
        }
        res.json(response)
      })

      await fetch(`${bskyUrl}/webhooks/revenuecat`, {
        method: 'POST',
        body: JSON.stringify({ event: { app_user_id: alice } }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      expect(
        getUserSubscriptionEntitlement(network, alice),
      ).resolves.toStrictEqual({
        did: alice,
        entitlements: [],
        createdAt,
        updatedAt: expect.any(String),
      })
    })
  })
})

async function createMockRevenueCatService(
  port: number,
  handler: jest.Mock,
): Promise<http.Server> {
  const app = express()

  app.use(express.json())
  app.get('/subscribers/:did', handler)

  const server = app.listen(port)
  await once(server, 'listening')
  return server
}

const getUserSubscriptionEntitlement = (network: TestNetwork, did: string) =>
  network.bsky.db.db
    .selectFrom('subscription_entitlement')
    .selectAll()
    .where('did', '=', did)
    .executeTakeFirst()
