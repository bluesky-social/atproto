import http from 'node:http'
import { once } from 'node:events'
import getPort from 'get-port'
import {
  authWithApiKey,
  BsyncClient,
  BsyncService,
  createClient,
  Database,
  envToCfg,
} from '../src'
import {
  RcEntitlement,
  RcEventBody,
  RcGetSubscriberResponse,
} from '../src/purchases'
import { Code, ConnectError } from '@connectrpc/connect'
import { GetSubscriptionsResponse } from '../src/proto/bsync_pb'
import { Timestamp } from '@bufbuild/protobuf'
import { DAY } from '@atproto/common'

const revenueCatWebhookAuthorization = 'Bearer any-token'

describe('purchases', () => {
  let bsync: BsyncService
  let client: BsyncClient
  let bsyncUrl: string

  const actorDid = 'did:example:a'

  let revenueCatServer: http.Server
  let revenueCatApiMock: jest.Mock<RcGetSubscriberResponse>

  const ONE_WEEK = DAY * 7
  const now = new Date()
  const twoWeeksAgo = new Date(now.valueOf() - ONE_WEEK * 2)
  const lastWeek = new Date(now.valueOf() - ONE_WEEK)
  const nextWeek = new Date(now.valueOf() + ONE_WEEK)

  const entitlementExpired: RcEntitlement = {
    expires_date: lastWeek.toISOString(),
  }
  const entitlementValid: RcEntitlement = {
    expires_date: nextWeek.toISOString(),
  }
  const entitlementValid2: RcEntitlement = {
    expires_date: nextWeek.toISOString(),
  }

  const stripePriceIdMonthly = 'price_id_monthly'
  const stripePriceIdAnnual = 'price_id_annual'
  const stripeProductIdMonthly = 'product_id_monthly'
  const stripeProductIdAnnual = 'product_id_annual'

  beforeAll(async () => {
    const revenueCatPort = await getPort()

    revenueCatApiMock = jest.fn()
    revenueCatServer = await createMockRevenueCatService(
      revenueCatPort,
      revenueCatApiMock,
    )

    bsync = await BsyncService.create(
      envToCfg({
        port: await getPort(),
        dbUrl: process.env.DB_POSTGRES_URL,
        dbSchema: 'bsync_purchases',
        apiKeys: ['key-1'],
        longPollTimeoutMs: 500,
        revenueCatV1ApiKey: 'any-key',
        revenueCatV1ApiUrl: `http://localhost:${revenueCatPort}`,
        revenueCatWebhookAuthorization,
        stripePriceIdMonthly,
        stripePriceIdAnnual,
        stripeProductIdMonthly,
        stripeProductIdAnnual,
      }),
    )

    bsyncUrl = `http://localhost:${bsync.ctx.cfg.service.port}`

    await bsync.ctx.db.migrateToLatestOrThrow()
    await bsync.start()
    client = createClient({
      httpVersion: '1.1',
      baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
      interceptors: [authWithApiKey('key-1')],
    })
  })

  afterAll(async () => {
    await bsync.destroy()
    revenueCatServer.close()
    await once(revenueCatServer, 'close')
  })

  beforeEach(async () => {
    await clearPurchases(bsync.ctx.db)
  })

  describe('webhook handler', () => {
    it('replies 403 if authorization is invalid', async () => {
      const response = await fetch(`${bsyncUrl}/webhooks/revenuecat`, {
        method: 'POST',
        body: JSON.stringify({ event: { app_user_id: actorDid } }),
        headers: {
          Authorization: `not ${revenueCatWebhookAuthorization}`,
          'Content-Type': 'application/json',
        },
      })

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body).toStrictEqual(
        structuredClone({
          error: 'Forbidden: invalid authentication for RevenueCat webhook',
          success: false,
        }),
      )
    })

    it('replies 400 if DID is invalid', async () => {
      const response = await callWebhook(bsyncUrl, buildWebhookBody('invalid'))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body).toStrictEqual(
        structuredClone({
          error: 'Bad request: invalid DID in app_user_id',
          success: false,
        }),
      )
    })

    it('replies 400 if body is invalid', async () => {
      const response = await callWebhook(bsyncUrl, {
        any: 'thing ',
      } as unknown as RcEventBody)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body).toStrictEqual(
        structuredClone({
          error: 'Bad request: body schema validation failed',
          success: false,
        }),
      )
    })

    it('stores sorted valid entitlements from the API response, excluding expired', async () => {
      revenueCatApiMock.mockReturnValue({
        subscriber: {
          entitlements: { entitlementExpired },
          subscriptions: {},
          subscriber_attributes: {},
        },
      })

      await callWebhook(bsyncUrl, buildWebhookBody(actorDid))

      const op0 = await bsync.ctx.db.db
        .selectFrom('purchase_op')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      expect(op0).toStrictEqual({
        id: expect.any(Number),
        actorDid,
        entitlements: [],
        createdAt: expect.any(Date),
      })

      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_item')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .executeTakeFirstOrThrow(),
      ).resolves.toStrictEqual({
        actorDid,
        entitlements: [],
        fromId: op0.id,
      })

      revenueCatApiMock.mockReturnValue({
        subscriber: {
          entitlements: {
            entitlementValid2,
            entitlementValid,
            entitlementExpired,
          },
          subscriptions: {},
          subscriber_attributes: {},
        },
      })

      await callWebhook(bsyncUrl, buildWebhookBody(actorDid))

      const op1 = await bsync.ctx.db.db
        .selectFrom('purchase_op')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      expect(op1).toStrictEqual({
        id: expect.any(Number),
        actorDid,
        entitlements: ['entitlementValid', 'entitlementValid2'],
        createdAt: expect.any(Date),
      })

      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_item')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .executeTakeFirstOrThrow(),
      ).resolves.toStrictEqual({
        actorDid,
        entitlements: ['entitlementValid', 'entitlementValid2'],
        fromId: op1.id,
      })
    })

    it('sets empty array in the cache if no entitlements are present at all', async () => {
      revenueCatApiMock.mockReturnValue({
        subscriber: {
          entitlements: {},
          subscriptions: {},
          subscriber_attributes: {},
        },
      })

      await callWebhook(bsyncUrl, buildWebhookBody(actorDid))

      const op = await bsync.ctx.db.db
        .selectFrom('purchase_op')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      expect(op).toStrictEqual({
        id: expect.any(Number),
        actorDid,
        entitlements: [],
        createdAt: expect.any(Date),
      })

      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_item')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .executeTakeFirstOrThrow(),
      ).resolves.toStrictEqual({
        actorDid,
        entitlements: [],
        fromId: op.id,
      })
    })
  })

  describe('refreshPurchases', () => {
    it('fails on bad inputs', async () => {
      await expect(
        client.refreshPurchases({
          actorDid: 'invalid',
        }),
      ).rejects.toStrictEqual(
        new ConnectError('actor_did must be a valid did', Code.InvalidArgument),
      )
    })

    it('stores valid entitlements from the API response, excluding expired', async () => {
      revenueCatApiMock.mockReturnValue({
        subscriber: {
          entitlements: { entitlementExpired },
          subscriptions: {},
          subscriber_attributes: {},
        },
      })

      await client.refreshPurchases({ actorDid })

      const op0 = await bsync.ctx.db.db
        .selectFrom('purchase_op')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      expect(op0).toStrictEqual({
        id: expect.any(Number),
        actorDid,
        entitlements: [],
        createdAt: expect.any(Date),
      })

      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_item')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .executeTakeFirstOrThrow(),
      ).resolves.toStrictEqual({
        actorDid,
        entitlements: [],
        fromId: op0.id,
      })

      revenueCatApiMock.mockReturnValue({
        subscriber: {
          entitlements: { entitlementValid, entitlementExpired },
          subscriptions: {},
          subscriber_attributes: {},
        },
      })

      await client.refreshPurchases({ actorDid })

      const op1 = await bsync.ctx.db.db
        .selectFrom('purchase_op')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      expect(op1).toStrictEqual({
        id: expect.any(Number),
        actorDid,
        entitlements: ['entitlementValid'],
        createdAt: expect.any(Date),
      })

      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_item')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .executeTakeFirstOrThrow(),
      ).resolves.toStrictEqual({
        actorDid,
        entitlements: ['entitlementValid'],
        fromId: op1.id,
      })
    })

    it('sets empty array in the cache if no entitlements are present at all', async () => {
      revenueCatApiMock.mockReturnValue({
        subscriber: {
          entitlements: {},
          subscriptions: {},
          subscriber_attributes: {},
        },
      })

      await client.refreshPurchases({ actorDid })

      const op = await bsync.ctx.db.db
        .selectFrom('purchase_op')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      expect(op).toStrictEqual({
        id: expect.any(Number),
        actorDid,
        entitlements: [],
        createdAt: expect.any(Date),
      })

      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_item')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .executeTakeFirstOrThrow(),
      ).resolves.toStrictEqual({
        actorDid,
        entitlements: [],
        fromId: op.id,
      })
    })

    it('only creates new operations if the entitlements differ from the current state', async () => {
      // 1. pre-check, no operations existing.
      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_op')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .execute(),
      ).resolves.toHaveLength(0)
      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_item')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .execute(),
      ).resolves.toHaveLength(0)

      // 2. 1 new entitlement, will generate 1 operation
      revenueCatApiMock.mockReturnValue({
        subscriber: {
          entitlements: { entitlementValid },
          subscriptions: {},
          subscriber_attributes: {},
        },
      })
      await client.refreshPurchases({ actorDid })

      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_op')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .execute(),
      ).resolves.toHaveLength(1)
      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_item')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .execute(),
      ).resolves.toHaveLength(1)

      // 3. 1 new entitlement, will generate 1 operation
      revenueCatApiMock.mockReturnValue({
        subscriber: {
          entitlements: { entitlementValid, entitlementValid2 },
          subscriptions: {},
          subscriber_attributes: {},
        },
      })
      await client.refreshPurchases({ actorDid })

      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_op')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .execute(),
      ).resolves.toHaveLength(2)
      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_item')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .execute(),
      ).resolves.toHaveLength(1)

      // 4. no new entitlements, will not generate new operations
      await client.refreshPurchases({ actorDid })

      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_op')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .execute(),
      ).resolves.toHaveLength(2)
      await expect(
        bsync.ctx.db.db
          .selectFrom('purchase_item')
          .selectAll()
          .where('actorDid', '=', actorDid)
          .execute(),
      ).resolves.toHaveLength(1)
    })
  })

  describe('getSubscriptions', () => {
    it('returns the email if returned from RC', async () => {
      revenueCatApiMock.mockReturnValue({
        subscriber: {
          entitlements: {},
          subscriptions: {},
          subscriber_attributes: {
            email: {
              value: 'test@test',
            },
          },
        },
      })

      const res = await client.getSubscriptions({ actorDid })

      expect(res).toStrictEqual(
        new GetSubscriptionsResponse({
          email: 'test@test',
          subscriptions: [],
        }),
      )
    })

    it('returns empty subscriptions if none returned from RC', async () => {
      revenueCatApiMock.mockReturnValue({
        subscriber: {
          entitlements: {},
          subscriptions: {},
          subscriber_attributes: {},
        },
      })

      const res = await client.getSubscriptions({ actorDid })

      expect(res).toStrictEqual(
        new GetSubscriptionsResponse({
          email: '',
          subscriptions: [],
        }),
      )
    })

    it('returns the mapped subscriptions data returned from RC', async () => {
      revenueCatApiMock.mockReturnValue({
        subscriber: {
          entitlements: {},
          subscriptions: {
            [stripeProductIdMonthly]: {
              auto_resume_date: null,
              expires_date: lastWeek.toISOString(),
              original_purchase_date: twoWeeksAgo.toISOString(),
              purchase_date: twoWeeksAgo.toISOString(),
              store: 'stripe',
              unsubscribe_detected_at: null,
            },
            [stripeProductIdAnnual]: {
              auto_resume_date: null,
              expires_date: nextWeek.toISOString(),
              original_purchase_date: lastWeek.toISOString(),
              purchase_date: lastWeek.toISOString(),
              store: 'stripe',
              unsubscribe_detected_at: null,
            },
          },
          subscriber_attributes: {},
        },
      })

      const res = await client.getSubscriptions({ actorDid })

      expect(res).toStrictEqual(
        new GetSubscriptionsResponse({
          email: '',
          subscriptions: [
            {
              status: 'expired',
              renewalStatus: 'will_not_renew',
              group: 'core',
              platform: 'web',
              offering: 'coreMonthly',
              periodEndsAt: Timestamp.fromDate(lastWeek),
              periodStartsAt: Timestamp.fromDate(twoWeeksAgo),
              purchasedAt: Timestamp.fromDate(twoWeeksAgo),
            },
            {
              status: 'active',
              renewalStatus: 'will_renew',
              group: 'core',
              platform: 'web',
              offering: 'coreAnnual',
              periodEndsAt: Timestamp.fromDate(nextWeek),
              periodStartsAt: Timestamp.fromDate(lastWeek),
              purchasedAt: Timestamp.fromDate(lastWeek),
            },
          ],
        }),
      )
    })
  })

  describe('getSubscriptionGroup', () => {
    type Input = { group: string; platform: string }
    type Expected = { offerings: { id: string; product: string }[] }

    it('returns the expected data when input is correct', async () => {
      const t = async (input: Input, expected: Expected) => {
        const res = await client.getSubscriptionGroup(input)
        expect(structuredClone(res)).toStrictEqual(structuredClone(expected))
      }

      await t(
        { group: 'core', platform: 'android' },
        {
          offerings: [
            { id: 'coreMonthly', product: 'bluesky_plus_core_v1:monthly' },
            { id: 'coreAnnual', product: 'bluesky_plus_core_v1:annual' },
          ],
        },
      )

      await t(
        { group: 'core', platform: 'ios' },
        {
          offerings: [
            { id: 'coreMonthly', product: 'bluesky_plus_core_v1_monthly' },
            { id: 'coreAnnual', product: 'bluesky_plus_core_v1_annual' },
          ],
        },
      )

      await t(
        { group: 'core', platform: 'web' },
        {
          offerings: [
            { id: 'coreMonthly', product: stripePriceIdMonthly },
            { id: 'coreAnnual', product: stripePriceIdAnnual },
          ],
        },
      )
    })

    it('throws the expected error when input is incorrect', async () => {
      const t = async (input: Input, expected: string) => {
        await expect(client.getSubscriptionGroup(input)).rejects.toThrow(
          expected,
        )
      }

      await t(
        { group: 'wrong-group', platform: 'android' },
        `invalid subscription group: 'wrong-group'`,
      )
      await t(
        { group: 'core', platform: 'wrong-platform' },
        `invalid platform: 'wrong-platform'`,
      )
    })
  })
})

const clearPurchases = async (db: Database) => {
  await db.db.deleteFrom('purchase_item').execute()
  await db.db.deleteFrom('purchase_op').execute()
}

const buildWebhookBody = (actorDid: string): RcEventBody => ({
  api_version: '1.0',
  event: {
    app_user_id: actorDid,
    type: 'INITIAL_PURCHASE',
  },
})

const callWebhook = async (
  baseUrl: string,
  body: RcEventBody,
): Promise<Response> => {
  return fetch(`${baseUrl}/webhooks/revenuecat`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: revenueCatWebhookAuthorization,
      'Content-Type': 'application/json',
    },
  })
}

const createMockRevenueCatService = async (
  port: number,
  apiMock: jest.Mock<RcGetSubscriberResponse>,
): Promise<http.Server> => {
  const server = http.createServer((req, res) => {
    if (!req.url) {
      throw new Error('Unexpected empty URL in request to RevenueCat mock')
    }

    if (/^\/subscribers\/(.*)$/.test(req.url)) {
      const response = apiMock(req, res)
      res.statusCode = 200
      return res.end(JSON.stringify(response))
    }

    throw new Error('Unexpected URL in request to RevenueCat mock')
  })

  server.listen(port)
  await once(server, 'listening')
  return server
}
