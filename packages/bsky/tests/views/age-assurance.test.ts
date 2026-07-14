import crypto from 'node:crypto'
import { once } from 'node:events'
import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import express, { type Application, type RequestHandler } from 'express'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { type AtpAgent, ids } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import type {
  KwsExternalPayload,
  KwsVerificationQuery,
  KwsWebhookBody,
} from '../../src/api/kws/types.js'
import {
  parseExternalPayload,
  serializeExternalPayload,
} from '../../src/api/kws/util.js'

type Database = TestNetwork['bsky']['db']

describe('age assurance views', () => {
  const verificationSecret = 'verificationSecret'
  const webhookSecret = 'webhookSecret'
  const attemptId = crypto.randomUUID()
  const redirectUrl = 'https://bsky.app/intent/age-assurance'

  let network: TestNetwork
  let db: Database
  let agent: AtpAgent
  let sc: SeedClient

  let actorDid: string

  let kwsServer: MockKwsServer

  const authMock = vi.fn<RequestHandler>((req, res) =>
    res.json({
      access_token:
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.INVALID',
      expires_in: 3600,
    }),
  )
  const sendEmailMock = vi.fn<RequestHandler>((req, res) => {
    res.json({})
  })

  beforeAll(async () => {
    kwsServer = new MockKwsServer({
      verificationSecret,
      webhookSecret,
      authMock,
      sendEmailMock,
    })
    await kwsServer.listen()

    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_age_assurance',
      bsky: {
        kws: {
          apiKey: 'apiKey',
          apiOrigin: kwsServer.url,
          authOrigin: kwsServer.url,
          clientId: 'clientId',
          redirectUrl,
          userAgent: 'userAgent',
          verificationSecret,
          webhookSecret,
          ageVerifiedWebhookSecret: 'ageVerifiedWebhookSecret',
          ageVerifiedRedirectSecret: 'ageVerifiedRedirectSecret',
        },
      },
    })
    db = network.bsky.db
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    actorDid = sc.dids.alice
  })

  beforeEach(async () => network.processAll())

  beforeEach(async () => {
    // @TODO Use the clearMocks setting in the configuration instead of:
    authMock.mockClear()
    sendEmailMock.mockClear()
  })

  afterEach(async () => {
    // Drain pending bsync ops before clearing, so a stale op can't land after
    // the reset.
    await network.processAll()
    await clearPrivateData(db)
    await clearActorAgeAssurance(db)
  })

  afterAll(async () => network?.close())
  afterAll(async () => kwsServer?.stop())

  const getAgeAssurance = async (did: string) => {
    const { data } = await agent.app.bsky.unspecced.getAgeAssuranceState(
      {},
      {
        headers: await network.serviceHeaders(
          did,
          ids.AppBskyUnspeccedGetAgeAssuranceState,
        ),
      },
    )
    return data
  }

  const initAgeAssurance = async (did: string, email?: string) => {
    const { data } = await agent.app.bsky.unspecced.initAgeAssurance(
      {
        email: email ?? sc.accounts[did].email,
        language: 'en',
        countryCode: 'CC',
      },
      {
        headers: await network.serviceHeaders(
          did,
          ids.AppBskyUnspeccedInitAgeAssurance,
        ),
      },
    )
    return data
  }

  describe('parsing external payload', () => {
    it('fails if actorDid is missing', () => {
      const serialized = JSON.stringify({
        attemptId,
      } satisfies Partial<KwsExternalPayload>)

      expect(() => parseExternalPayload(serialized)).toThrow(
        `Invalid external payload`,
      )
    })

    it('fails if attemptId is missing', () => {
      const serialized = JSON.stringify({
        actorDid,
      } satisfies Partial<KwsExternalPayload>)

      expect(() => parseExternalPayload(serialized)).toThrow(
        `Invalid external payload`,
      )
    })

    it('fails if extra field is present', () => {
      const serialized = JSON.stringify({
        actorDid,
        attemptId,
        extra: 'field',
      } satisfies KwsExternalPayload & { extra: string })

      expect(() => parseExternalPayload(serialized)).toThrow(
        `Invalid external payload`,
      )
    })

    it('does not fail if all fields are set', () => {
      const externalPayload: KwsExternalPayload = {
        actorDid,
        attemptId,
      }
      const serialized = JSON.stringify(externalPayload)

      const parsed = parseExternalPayload(serialized)
      expect(parsed).toStrictEqual(externalPayload)
    })
  })

  it('fetches AA state correctly if user never did the flow', async () => {
    const aliceState = await getAgeAssurance(actorDid)
    expect(aliceState).toEqual({
      status: 'unknown',
    })
  })

  it('validates email used for AA flow', async () => {
    await expect(initAgeAssurance(actorDid, 'invalid-email')).rejects.toThrow(
      'This email address is not supported,',
    )
  })

  it('ensures user cannot re-init flow from terminal state', async () => {
    const actor = sc.dids.bob
    const state0 = await getAgeAssurance(actor)
    expect(state0).toStrictEqual({
      status: 'unknown',
    })

    const init1 = await initAgeAssurance(actor)
    expect(init1).toStrictEqual({
      status: 'pending',
      lastInitiatedAt: expect.any(String),
    })

    const init2 = await initAgeAssurance(actor)
    expect(init2).toStrictEqual({
      status: 'pending',
      lastInitiatedAt: expect.any(String),
    })

    /**
     * Can re-init flow if the state is pending.
     */
    expect(sendEmailMock).toHaveBeenCalledTimes(2)

    const externalPayload: KwsExternalPayload = {
      actorDid: actor,
      attemptId,
    }
    const status = { verified: true }
    await kwsServer.callVerificationResponse(network.bsky.url, {
      externalPayload,
      status,
    })
    await network.processAll()
    const finalizedState = await getAgeAssurance(actor)
    expect(finalizedState).toStrictEqual({
      status: 'assured',
      lastInitiatedAt: expect.any(String),
    })

    await expect(initAgeAssurance(actor)).rejects.toThrow(
      `Cannot initiate age assurance flow from current state: assured`,
    )
  })

  describe('verification response flow', () => {
    it('performs the AA flow', async () => {
      const state0 = await getAgeAssurance(actorDid)
      expect(state0).toStrictEqual({
        status: 'unknown',
      })

      const state1 = await initAgeAssurance(actorDid)
      expect(state1).toStrictEqual({
        status: 'pending',
        lastInitiatedAt: expect.any(String),
      })
      expect(sendEmailMock).toHaveBeenCalledTimes(1)

      const externalPayload: KwsExternalPayload = {
        actorDid,
        attemptId,
      }
      const status = { verified: true }
      const verificationRes = await kwsServer.callVerificationResponse(
        network.bsky.url,
        { externalPayload, status },
      )
      expect(verificationRes.status).toBe(302)
      expect(verificationRes.headers.get('Location')).toBe(
        `${redirectUrl}?actorDid=${encodeURIComponent(actorDid)}&result=success`,
      )

      await network.processAll()
      const state2 = await getAgeAssurance(actorDid)
      expect(state2).toStrictEqual({
        status: 'assured',
        lastInitiatedAt: expect.any(String),
      })
    })

    it('does not assure if the verification response has status not verified', async () => {
      await initAgeAssurance(actorDid)

      const externalPayload: KwsExternalPayload = {
        actorDid,
        attemptId,
      }
      const status = { verified: false }
      const verificationRes = await kwsServer.callVerificationResponse(
        network.bsky.url,
        { externalPayload, status },
      )
      expect(verificationRes.status).toBe(302)
      expect(verificationRes.headers.get('Location')).toBe(
        `${redirectUrl}?result=unknown`,
      )

      await network.processAll()
      const state = await getAgeAssurance(actorDid)
      expect(state).toStrictEqual({
        status: 'pending',
        lastInitiatedAt: expect.any(String),
      })
    })
  })

  describe('webhook flow', () => {
    it('performs the AA flow', async () => {
      const state0 = await getAgeAssurance(actorDid)
      expect(state0).toStrictEqual({
        status: 'unknown',
      })

      const state1 = await initAgeAssurance(actorDid)
      expect(state1).toStrictEqual({
        status: 'pending',
        lastInitiatedAt: expect.any(String),
      })
      expect(sendEmailMock).toHaveBeenCalledTimes(1)

      const webhookRes = await kwsServer.callWebhook(network.bsky.url, {
        payload: {
          externalPayload: {
            actorDid,
            attemptId,
          },
          status: {
            verified: true,
          },
        },
      })
      expect(webhookRes.status).toBe(200)

      await network.processAll()
      const state2 = await getAgeAssurance(actorDid)
      expect(state2).toStrictEqual({
        status: 'assured',
        lastInitiatedAt: expect.any(String),
      })
    })

    it('does not assure if the webhook has status not verified', async () => {
      await initAgeAssurance(actorDid)

      const webhookRes = await kwsServer.callWebhook(network.bsky.url, {
        payload: {
          externalPayload: {
            actorDid,
            attemptId,
          },
          status: {
            verified: false,
          },
        },
      })
      expect(webhookRes.status).toBe(500)

      await network.processAll()
      const state = await getAgeAssurance(actorDid)
      expect(state).toStrictEqual({
        status: 'pending',
        lastInitiatedAt: expect.any(String),
      })
    })
  })
})

const clearPrivateData = async (db: Database) => {
  await db.db.deleteFrom('private_data').execute()
}

const clearActorAgeAssurance = async (db: Database) => {
  await db.db
    .updateTable('actor')
    .set({
      ageAssuranceStatus: null,
      ageAssuranceLastInitiatedAt: null,
    })
    .execute()
}

class MockKwsServer {
  private verificationSecret: string
  private webhookSecret: string
  private app: Application
  private server: Server
  private terminator: httpTerminator.HttpTerminator

  constructor({
    verificationSecret,
    webhookSecret,
    authMock,
    sendEmailMock,
  }: {
    verificationSecret: string
    webhookSecret: string
    authMock: RequestHandler
    sendEmailMock: RequestHandler
  }) {
    this.verificationSecret = verificationSecret
    this.webhookSecret = webhookSecret

    this.app = express()
      .post('/auth/realms/kws/protocol/openid-connect/token', authMock)
      .post('/v1/verifications/send-email', sendEmailMock)

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

  callVerificationResponse(
    bskyUrl: string,
    query: Omit<KwsVerificationQuery, 'signature'>,
  ) {
    const externalPayloadJson = JSON.stringify(query.externalPayload)
    const statusJson = JSON.stringify(query.status)

    const sig = crypto
      .createHmac('sha256', this.verificationSecret)
      .update(`${statusJson}:${externalPayloadJson}`)
      .digest('hex')

    const queryString = new URLSearchParams({
      externalPayload: externalPayloadJson,
      signature: sig,
      status: statusJson,
    }).toString()

    return fetch(
      `${bskyUrl}/external/kws/age-assurance-verification?${queryString}`,
      {
        method: 'GET',
        redirect: 'manual',
      },
    )
  }

  callWebhook(bskyUrl: string, body: KwsWebhookBody): Promise<Response> {
    const withSerializedExternalPayload = {
      ...body,
      payload: {
        ...body.payload,
        externalPayload: serializeExternalPayload(body.payload.externalPayload),
      },
    }
    const bodyBuffer = Buffer.from(
      JSON.stringify(withSerializedExternalPayload),
    )

    const timestamp = new Date().valueOf()
    const sig = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${bodyBuffer}`)
      .digest('hex')

    return fetch(`${bskyUrl}/external/kws/age-assurance-webhook`, {
      method: 'POST',
      body: bodyBuffer,
      headers: {
        'x-kws-signature': `t=${timestamp},v1=${sig}`,
        'Content-Type': 'application/json',
      },
    })
  }

  get url() {
    const address = this.server.address() as AddressInfo
    return `http://localhost:${address.port}`
  }
}
