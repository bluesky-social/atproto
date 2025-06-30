import crypto from 'node:crypto'
import { once } from 'node:events'
import { Server, createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import express, { Application } from 'express'
import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { AgeAssuranceClient } from '../../dist/age-assurance'
import { AgeAssuranceExternalPayload } from '../../src/age-assurance'
import { ids } from '../../src/lexicon/lexicons'

type Database = TestNetwork['bsky']['db']

describe('age assurance views', () => {
  const webhookSigningKey = 'webhookSigningKey'
  const attemptId = crypto.randomUUID()
  const attemptIp = '8.42.140.125'

  let network: TestNetwork
  let db: Database
  let agent: AtpAgent
  let sc: SeedClient
  let aac: AgeAssuranceClient

  // account dids, for convenience
  let actorDid: string
  let alice: string

  let kwsServer: MockKwsServer
  let authMock: jest.Mock
  let sendEmailMock: jest.Mock

  beforeAll(async () => {
    // Default mocks for KWS endpoints.
    authMock = jest.fn((_req: express.Request, res: express.Response) =>
      res.json({ access_token: 'access_token' }),
    )
    sendEmailMock = jest.fn((_req: express.Request, res: express.Response) => {
      res.json({})
    })

    kwsServer = new MockKwsServer({
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
          apiUrl: kwsServer.url,
          authUrl: kwsServer.url,
          clientId: 'clientId',
          signingKey: 'signingKey',
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

  afterEach(async () => {
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

        expect(() => aac.parseExternalPayload(serialized)).toThrow(
          `Invalid external payload: {"attemptId":"${attemptId}","attemptIp":"${attemptIp}"}`,
        )
      })

      it('fails if attemptId is missing', () => {
        const serialized = JSON.stringify({
          actorDid,
          attemptIp,
        })

        expect(() => aac.parseExternalPayload(serialized)).toThrow(
          `Invalid external payload: {"actorDid":"${actorDid}","attemptIp":"${attemptIp}"}`,
        )
      })

      it('fails if extra field is present', () => {
        const serialized = JSON.stringify({
          actorDid,
          attemptId,
          extra: 'field',
        })

        expect(() => aac.parseExternalPayload(serialized)).toThrow(
          `Invalid external payload: {"actorDid":"${actorDid}","attemptId":"${attemptId}","extra":"field"}`,
        )
      })

      it('does not fail if attemptIp is missing', () => {
        const payload: AgeAssuranceExternalPayload = {
          actorDid,
          attemptId,
        }
        const serialized = JSON.stringify(payload)

        const parsed = aac.parseExternalPayload(serialized)
        expect(parsed).toStrictEqual(payload)
      })

      it('does not fail if all fields are set', () => {
        const payload: AgeAssuranceExternalPayload = {
          actorDid,
          attemptId,
          attemptIp,
        }
        const serialized = JSON.stringify(payload)

        const parsed = aac.parseExternalPayload(serialized)
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

  it('performs AA flow with KWS verification response flow', async () => {
    // @TODO
  })

  it('performs AA flow AA with KWS webhook flow', async () => {
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
      name: 'adult-verified',
      time: '2025-06-24T17:03:01.738Z',
      orgId: 'mock-uuid',
      payload: {
        parentEmail: 'parent@email.com',
        externalPayload: serializeExternalPayload({
          actorDid,
          attemptId,
        }),
        status: {
          verified: true,
          transactionId: 'pqr678',
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

const serializeExternalPayload = (p: AgeAssuranceExternalPayload): string =>
  JSON.stringify(p)

class MockKwsServer {
  private webhookSigningKey: string
  private app: Application
  private server: Server

  constructor({
    webhookSigningKey,
    authMock,
    sendEmailMock,
  }: {
    webhookSigningKey: string
    authMock: jest.Mock
    sendEmailMock: jest.Mock
  }) {
    this.webhookSigningKey = webhookSigningKey

    this.app = express()
      .post('/auth/realms/kws/protocol/openid-connect/token', (req, res) =>
        authMock(req, res),
      )
      .post('/verifications/send-email', (req, res) => sendEmailMock(req, res))

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

  async callWebhook(
    bskyUrl: string,
    body: Record<string, unknown>,
  ): Promise<Response> {
    const timestamp = new Date().valueOf()
    const bodyBuffer = Buffer.from(JSON.stringify(body))

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
