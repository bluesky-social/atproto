import crypto from 'node:crypto'
import { once } from 'node:events'
import { Server, createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import express, { Application } from 'express'
import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { AgeAssuranceClient } from '../../dist/age-assurance'
import {
  AgeAssuranceExternalPayload,
  AgeAssuranceWebhookBody,
} from '../../src/api/kws/types'
import {
  parseExternalPayload,
  serializeExternalPayload,
} from '../../src/api/kws/util'
import { ids } from '../../src/lexicon/lexicons'

type Database = TestNetwork['bsky']['db']

describe('age assurance views', () => {
  const signingKey = 'signingKey'
  const webhookSigningKey = 'webhookSigningKey'
  const attemptId = crypto.randomUUID()
  const attemptIp = '8.42.140.125'
  const redirectUrl = 'https://bsky.app/intent/age-assurance'

  let network: TestNetwork
  let db: Database
  let agent: AtpAgent
  let sc: SeedClient
  let aac: AgeAssuranceClient

  // account dids, for convenience
  let actorDid: string
  let alice: string

  let kwsServer: MockKwsServer
  const authMock = jest.fn()
  const sendEmailMock = jest.fn()

  beforeAll(async () => {
    kwsServer = new MockKwsServer({
      signingKey,
      webhookSigningKey,
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
          signingKey,
          userAgent: 'userAgent',
          webhookSigningKey,
        },
      },
    })
    db = network.bsky.db
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    aac = network.bsky.ctx.ageAssuranceClient!
    await basicSeed(sc)
    await network.processAll()

    alice = sc.dids.alice
    actorDid = alice
  })

  beforeEach(async () => {
    // Default mocks for KWS endpoints.
    authMock.mockImplementation(
      (_req: express.Request, res: express.Response) =>
        res.json({
          access_token:
            'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.INVALID',
          expires_in: 3600,
        }),
    )
    sendEmailMock.mockImplementation(
      (_req: express.Request, res: express.Response) => {
        res.json({})
      },
    )
  })

  afterEach(async () => {
    jest.resetAllMocks()
    await clearPrivateData(db)
    await clearActorAgeAssurance(db)
  })

  afterAll(async () => {
    await network.close()
    await kwsServer.stop()
  })

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

  const initAgeAssurance = async (did: string) => {
    const { data } = await agent.app.bsky.unspecced.initAgeAssurance(
      { email: sc.accounts[did].email, language: 'en' },
      {
        headers: await network.serviceHeaders(
          did,
          ids.AppBskyUnspeccedInitAgeAssurance,
        ),
      },
    )
    return data
  }

  describe('age assurance client', () => {
    describe('parsing external payload', () => {
      it('fails if actorDid is missing', () => {
        const serialized = JSON.stringify({
          attemptId,
          attemptIp,
        })

        expect(() => parseExternalPayload(serialized)).toThrow(
          `Invalid external payload: {"attemptId":"${attemptId}","attemptIp":"${attemptIp}"}`,
        )
      })

      it('fails if attemptId is missing', () => {
        const serialized = JSON.stringify({
          actorDid,
          attemptIp,
        })

        expect(() => parseExternalPayload(serialized)).toThrow(
          `Invalid external payload: {"actorDid":"${actorDid}","attemptIp":"${attemptIp}"}`,
        )
      })

      it('fails if extra field is present', () => {
        const serialized = JSON.stringify({
          actorDid,
          attemptId,
          extra: 'field',
        })

        expect(() => parseExternalPayload(serialized)).toThrow(
          `Invalid external payload: {"actorDid":"${actorDid}","attemptId":"${attemptId}","extra":"field"}`,
        )
      })

      it('does not fail if attemptIp is missing', () => {
        const payload: AgeAssuranceExternalPayload = {
          actorDid,
          attemptId,
        }
        const serialized = JSON.stringify(payload)

        const parsed = parseExternalPayload(serialized)
        expect(parsed).toStrictEqual(payload)
      })

      it('does not fail if all fields are set', () => {
        const payload: AgeAssuranceExternalPayload = {
          actorDid,
          attemptId,
          attemptIp,
        }
        const serialized = JSON.stringify(payload)

        const parsed = parseExternalPayload(serialized)
        expect(parsed).toStrictEqual(payload)
      })
    })
  })

  it('fetches AA state correctly if user never did the flow', async () => {
    const aliceState = await getAgeAssurance(actorDid)
    expect(aliceState).toEqual({
      status: 'unknown',
    })
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

      const externalPayload = {
        actorDid,
        attemptId,
      }
      const status = { verified: true }
      const verificationRes = await kwsServer.callVerificationResponse(
        network.bsky.url,
        externalPayload,
        status,
      )
      expect(verificationRes.status).toBe(302)
      expect(verificationRes.headers.get('Location')).toBe(
        `${redirectUrl}?success=true`,
      )

      const state2 = await getAgeAssurance(actorDid)
      expect(state2).toStrictEqual({
        status: 'assured',
        lastInitiatedAt: expect.any(String),
      })
    })

    it('does not assure if the verification response has status not verified', async () => {
      await initAgeAssurance(actorDid)

      const externalPayload = {
        actorDid,
        attemptId,
      }
      const status = { verified: false }
      const verificationRes = await kwsServer.callVerificationResponse(
        network.bsky.url,
        externalPayload,
        status,
      )
      expect(verificationRes.status).toBe(302)
      expect(verificationRes.headers.get('Location')).toBe(
        `${redirectUrl}?success=false`,
      )

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

      const webhookRes = await kwsServer.callWebhook(aac, network.bsky.url, {
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

      const state2 = await getAgeAssurance(actorDid)
      expect(state2).toStrictEqual({
        status: 'assured',
        lastInitiatedAt: expect.any(String),
      })
    })

    it('does not assure if the webhook has status not verified', async () => {
      await initAgeAssurance(actorDid)

      const webhookRes = await kwsServer.callWebhook(aac, network.bsky.url, {
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
      expect(webhookRes.status).toBe(200)

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
  private signingKey: string
  private webhookSigningKey: string
  private app: Application
  private server: Server

  constructor({
    signingKey,
    webhookSigningKey,
    authMock,
    sendEmailMock,
  }: {
    signingKey: string
    webhookSigningKey: string
    authMock: jest.Mock
    sendEmailMock: jest.Mock
  }) {
    this.signingKey = signingKey
    this.webhookSigningKey = webhookSigningKey

    this.app = express()
      .post('/auth/realms/kws/protocol/openid-connect/token', (req, res) =>
        authMock(req, res),
      )
      .post('/v1/verifications/send-email', (req, res) =>
        sendEmailMock(req, res),
      )

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

  callVerificationResponse(
    bskyUrl: string,
    externalPayload: Record<string, unknown>,
    status: Record<string, unknown>,
  ) {
    const externalPayloadJson = JSON.stringify(externalPayload)
    const statusJson = JSON.stringify(status)

    const sig = crypto
      .createHmac('sha256', this.signingKey)
      .update(`${statusJson}:${externalPayloadJson}`)
      .digest('hex')

    const queryString = new URLSearchParams({
      externalPayload: externalPayloadJson,
      signature: sig,
      status: statusJson,
    }).toString()

    return fetch(
      `${bskyUrl}/external/kws/age-assurance-verification-response?${queryString}`,
      {
        method: 'GET',
        redirect: 'manual',
      },
    )
  }

  callWebhook(
    aac: AgeAssuranceClient,
    bskyUrl: string,
    body: AgeAssuranceWebhookBody,
  ): Promise<Response> {
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
      .createHmac('sha256', this.webhookSigningKey)
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
