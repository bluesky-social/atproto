import http from 'node:http'
import { once } from 'node:events'
import getPort from 'get-port'
import { BsyncService, Database, envToCfg } from '../src'
import { RcEntitlement, RcGetSubscriberResponse } from '../src/purchases'

const revenueCatWebhookAuthorization = 'Bearer any-token'

describe('purchases', () => {
  let bsync: BsyncService
  let bsyncUrl: string

  const actorDid = 'did:example:a'

  let revenueCatServer: http.Server
  let revenueCatApiMock: jest.Mock<RcGetSubscriberResponse>

  const TEN_MINUTES = 600_000
  const entitlementValid: RcEntitlement = {
    expires_date: new Date(Date.now() + TEN_MINUTES).toISOString(),
  }
  const entitlementExpired: RcEntitlement = {
    expires_date: new Date(Date.now() - TEN_MINUTES).toISOString(),
  }

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
      }),
    )

    bsyncUrl = `http://localhost:${bsync.ctx.cfg.service.port}`

    await bsync.ctx.db.migrateToLatestOrThrow()
    await bsync.start()
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
    it('returns 403 if authorization is invalid', async () => {
      const response = await fetch(`${bsyncUrl}/webhooks/revenuecat`, {
        method: 'POST',
        body: JSON.stringify({ event: { app_user_id: actorDid } }),
        headers: {
          Authorization: `not ${revenueCatWebhookAuthorization}`,
          'Content-Type': 'application/json',
        },
      })

      expect(response.status).toBe(403)
      expect(response.json()).resolves.toMatchObject({
        error: 'Forbidden: invalid authentication for RevenueCat webhook',
      })
    })

    it('returns 400 if DID is invalid', async () => {
      const response = await callWebhook(bsyncUrl, {
        event: { app_user_id: 'invalidDid' },
      })

      expect(response.status).toBe(400)
      expect(response.json()).resolves.toMatchObject({
        error: 'Bad request: invalid DID in app_user_id',
      })
    })

    it('stores valid entitlements from the API response, excluding expired', async () => {
      revenueCatApiMock.mockReturnValueOnce({
        subscriber: {
          entitlements: { entitlementExpired },
        },
      })

      await callWebhook(bsyncUrl, {
        event: { app_user_id: actorDid },
      })

      const op0 = await bsync.ctx.db.db
        .selectFrom('purchase_op')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      expect(op0).toMatchObject({
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
      ).resolves.toMatchObject({
        actorDid,
        entitlements: [],
        fromId: op0.id,
      })

      revenueCatApiMock.mockReturnValueOnce({
        subscriber: {
          entitlements: { entitlementValid, entitlementExpired },
        },
      })

      await callWebhook(bsyncUrl, {
        event: { app_user_id: actorDid },
      })

      const op1 = await bsync.ctx.db.db
        .selectFrom('purchase_op')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      expect(op1).toMatchObject({
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
      ).resolves.toMatchObject({
        actorDid,
        entitlements: ['entitlementValid'],
        fromId: op1.id,
      })
    })

    it('sets empty array in the cache if no entitlements are present at all', async () => {
      revenueCatApiMock.mockReturnValue({
        subscriber: { entitlements: {} },
      })

      await callWebhook(bsyncUrl, {
        event: { app_user_id: actorDid },
      })

      const op = await bsync.ctx.db.db
        .selectFrom('purchase_op')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      expect(op).toMatchObject({
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
      ).resolves.toMatchObject({
        actorDid,
        entitlements: [],
        fromId: op.id,
      })
    })
  })
})

const clearPurchases = async (db: Database) => {
  await db.db.deleteFrom('purchase_item').execute()
  await db.db.deleteFrom('purchase_op').execute()
}

const callWebhook = async (
  baseUrl: string,
  body: Record<string, unknown>,
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
