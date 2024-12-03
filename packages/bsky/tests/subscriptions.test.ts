import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import express from 'express'
import http from 'node:http'
import { once } from 'node:events'
import { GetSubscriberResponse } from '../src/subscriptions'

describe('subscriptions views', () => {
  let network: TestNetwork
  let sc: SeedClient
  let revenueCatServer: http.Server
  let revenueCatHandler: jest.Mock
  let bskyUrl: string

  // account dids, for convenience
  let alice: string

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
    it('sets the cache with the entitlements from the API response', async () => {
      await network.bsky.db.db
        .insertInto('subscription_entitlement')
        .values({
          did: alice,
          entitlements: JSON.stringify(['entitlement0']),
        })
        .execute()

      const before = await network.bsky.db.db
        .selectFrom('subscription_entitlement')
        .selectAll()
        .execute()

      expect(before).toStrictEqual([
        { did: alice, entitlements: ['entitlement0'] },
      ])

      revenueCatHandler.mockImplementation((req, res) => {
        const response: GetSubscriberResponse = {
          subscriber: {
            entitlements: {
              entitlement1: {},
              entitlement2: {},
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

      const after = await network.bsky.db.db
        .selectFrom('subscription_entitlement')
        .selectAll()
        .execute()

      expect(after).toStrictEqual([
        { did: alice, entitlements: ['entitlement1', 'entitlement2'] },
      ])
    })

    it('clears the cache if the API response returns no entitlements', async () => {
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

      const after = await network.bsky.db.db
        .selectFrom('subscription_entitlement')
        .selectAll()
        .execute()

      expect(after).toHaveLength(0)
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
