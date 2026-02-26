import crypto from 'node:crypto'
import { once } from 'node:events'
import { Server, createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import express, { Application, json } from 'express'
import {
  AppBskyAgeassuranceDefs,
  AtpAgent,
  ageAssuranceRuleIDs as ruleIds,
} from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import {
  type KWSWebhookAgeVerified,
  serializeKWSAgeVerifiedStatus,
} from '../../src/api/age-assurance/kws/age-verified'
import {
  KWSExternalPayloadVersion,
  serializeKWSExternalPayloadV1,
  serializeKWSExternalPayloadV2,
} from '../../src/api/age-assurance/kws/external-payload'
import { KwsWebhookBody } from '../../src/api/kws/types'
import { ids } from '../../src/lexicon/lexicons'
import * as AppBskyAgeassuranceBegin from '../../src/lexicon/types/app/bsky/ageassurance/begin'
import * as AppBskyAgeassuranceGetState from '../../src/lexicon/types/app/bsky/ageassurance/getState'

type Database = TestNetwork['bsky']['db']

const BSKY_REDIRECT_URL = 'http://bsky'

jest.mock('../../dist/api/age-assurance/const.js', () => {
  const AGE_ASSURANCE_CONFIG: AppBskyAgeassuranceDefs.Config = {
    regions: [
      {
        countryCode: 'AA',
        regionCode: undefined,
        minAccessAge: 13,
        rules: [
          {
            $type: ruleIds.IfAssuredOverAge,
            age: 18,
            access: 'full',
          },
          {
            $type: ruleIds.Default,
            access: 'safe',
          },
        ],
      },
      {
        countryCode: 'BB',
        regionCode: undefined,
        minAccessAge: 13,
        rules: [
          {
            $type: ruleIds.IfAssuredOverAge,
            age: 18,
            access: 'full',
          },
          {
            $type: ruleIds.Default,
            access: 'safe',
          },
        ],
      },
    ],
  }
  return {
    AGE_ASSURANCE_CONFIG,
  }
})

jest.mock('../../dist/api/age-assurance/kws/const.js', () => {
  const actual = jest.requireActual('../../dist/api/age-assurance/kws/const.js')
  const KWS_V2_COUNTRIES = new Set(['AA'])
  return {
    ...actual,
    KWS_V2_COUNTRIES,
  }
})

describe('age assurance v2 views', () => {
  let network: TestNetwork
  let db: Database
  let agent: AtpAgent
  let sc: SeedClient
  let kws: MockKwsServer

  const kwsOauthMock = jest.fn()
  const kwsSendAgeVerifiedFlowEmailMock = jest.fn()
  const kwsSendAdultVerifiedFlowEmailMock = jest.fn()
  const actor = {
    did: '',
    email: '',
  }

  beforeAll(async () => {
    kws = new MockKwsServer({
      oauthMock: kwsOauthMock,
      sendAgeVerifiedFlowEmailMock: kwsSendAgeVerifiedFlowEmailMock,
      sendAdultVerifiedFlowEmailMock: kwsSendAdultVerifiedFlowEmailMock,
    })
    await kws.listen()

    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_age_assurance_v_two',
      bsky: {
        kws: {
          apiKey: 'apiKey',
          apiOrigin: kws.url,
          authOrigin: kws.url,
          clientId: 'clientId',
          redirectUrl: BSKY_REDIRECT_URL,
          userAgent: 'userAgent',
          verificationSecret: kws.verificationSecret,
          webhookSecret: kws.webhookSecret,
          ageVerifiedWebhookSecret: kws.ageVerifiedWebhookSecret,
          ageVerifiedRedirectSecret: kws.ageVerifiedRedirectSecret,
        },
      },
    })

    kws.setBskyBaseUrl(network.bsky.url)

    db = network.bsky.db
    agent = network.bsky.getClient()
    sc = network.getSeedClient()

    await basicSeed(sc)
    await network.processAll()

    actor.did = sc.dids.alice
    actor.email = sc.accounts[actor.did].email
  })

  beforeEach(async () => {
    // Default mocks for KWS endpoints.
    kwsOauthMock.mockImplementation(
      (_req: express.Request, res: express.Response) =>
        res.json({
          access_token:
            'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.INVALID',
          expires_in: 3600,
        }),
    )
    kwsSendAgeVerifiedFlowEmailMock.mockImplementation(
      (_req: express.Request, res: express.Response) => {
        res.json({})
      },
    )
    kwsSendAdultVerifiedFlowEmailMock.mockImplementation(
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
    await kws.stop()
  })

  const getState = async (params: AppBskyAgeassuranceGetState.QueryParams) => {
    const { data } = await agent.app.bsky.ageassurance.getState(params, {
      headers: await network.serviceHeaders(
        actor.did,
        ids.AppBskyAgeassuranceGetState,
      ),
    })
    return data
  }

  const beginAgeAssurance = async (
    params: Omit<AppBskyAgeassuranceBegin.InputSchema, 'email' | 'language'> & {
      email?: string
    },
  ) => {
    const { data } = await agent.app.bsky.ageassurance.begin(
      {
        ...params,
        email: params.email || sc.accounts[actor.did].email,
        language: 'en',
      },
      {
        headers: await network.serviceHeaders(
          actor.did,
          ids.AppBskyAgeassuranceBegin,
        ),
      },
    )
    return data
  }

  describe('app.bsky.ageassurance.getState', () => {
    it('initially returns defaults', async () => {
      const { state, metadata } = await getState({
        countryCode: 'US',
        regionCode: undefined,
      })
      expect(metadata.accountCreatedAt).toBeDefined()
      expect(state).toEqual({
        lastInitatedAt: undefined,
        status: 'unknown',
        access: 'unknown',
      })
    })
  })

  describe('app.bsky.ageassurance.begin', () => {
    it('fails if region not supported', async () => {
      const call = beginAgeAssurance({
        countryCode: 'XX',
      })
      await expect(call).rejects.toHaveProperty('error', 'RegionNotSupported')
    })

    it('fails if email is invalid', async () => {
      const call = beginAgeAssurance({
        email: 'invalid-email',
        countryCode: 'XX',
      })
      await expect(call).rejects.toHaveProperty('error', 'InvalidEmail')
    })

    it('succeeds for V2 country', async () => {
      const res = await beginAgeAssurance({
        countryCode: 'AA',
      })
      await network.processAll()
      const { state } = await getState({
        countryCode: 'AA',
      })
      expect(kwsSendAgeVerifiedFlowEmailMock).toHaveBeenCalledTimes(1)
      expect(res).toEqual(state)
      expect(state.lastInitiatedAt).toBeDefined()
      expect(state.status).toEqual('pending')
      expect(state.access).toEqual('unknown')
    })

    it('succeeds for V1 country', async () => {
      const res = await beginAgeAssurance({
        countryCode: 'BB',
      })
      await network.processAll()
      const { state } = await getState({
        countryCode: 'BB',
      })
      expect(kwsSendAdultVerifiedFlowEmailMock).toHaveBeenCalledTimes(1)
      expect(res).toEqual(state)
      expect(state.lastInitiatedAt).toBeDefined()
      expect(state.status).toEqual('pending')
      expect(state.access).toEqual('unknown')
    })
  })

  describe('external handlers', () => {
    describe('V2 redirects', () => {
      it('redirects with result=unknown if we fail to parse the status object', async () => {
        const res = await kws.redirectV2({
          externalPayload: serializeKWSExternalPayloadV2({
            version: KWSExternalPayloadVersion.V2,
            actorDid: actor.did,
            attemptId: crypto.randomUUID(),
            countryCode: 'AA',
          }),
          status: JSON.stringify({
            verified: true,
            verifiedMinimumAge: '18', // will fail parsing
          }),
        })
        expect(res.status).toBe(302)
        expect(res.headers.get('Location')).toBe(
          `${BSKY_REDIRECT_URL}?result=unknown`,
        )
      })

      it('redirects with result=unknown if status is not verified', async () => {
        const res = await kws.redirectV2({
          externalPayload: serializeKWSExternalPayloadV2({
            version: KWSExternalPayloadVersion.V2,
            actorDid: actor.did,
            attemptId: crypto.randomUUID(),
            countryCode: 'AA',
          }),
          status: serializeKWSAgeVerifiedStatus({
            verified: false,
            verifiedMinimumAge: 18,
          }),
        })
        expect(res.status).toBe(302)
        expect(res.headers.get('Location')).toBe(
          `${BSKY_REDIRECT_URL}?actorDid=${encodeURIComponent(actor.did)}&result=unknown`,
        )
      })

      // this also covers any other thrown errors
      it('redirects with result=unknown if access check throws', async () => {
        const res = await kws.redirectV2({
          externalPayload: serializeKWSExternalPayloadV2({
            version: KWSExternalPayloadVersion.V2,
            actorDid: actor.did,
            attemptId: crypto.randomUUID(),
            countryCode: 'XX', // should never reach KWS anyway
          }),
          status: serializeKWSAgeVerifiedStatus({
            verified: true,
            verifiedMinimumAge: 18,
          }),
        })
        expect(res.status).toBe(302)
        expect(res.headers.get('Location')).toBe(
          `${BSKY_REDIRECT_URL}?actorDid=${encodeURIComponent(actor.did)}&result=unknown`,
        )
      })

      it('success', async () => {
        await beginAgeAssurance({
          countryCode: 'AA',
        })
        await network.processAll()
        await kws.redirectV2({
          externalPayload: serializeKWSExternalPayloadV2({
            version: KWSExternalPayloadVersion.V2,
            actorDid: actor.did,
            attemptId: crypto.randomUUID(),
            countryCode: 'AA',
          }),
          status: serializeKWSAgeVerifiedStatus({
            verified: true,
            verifiedMinimumAge: 18,
          }),
        })
        await network.processAll()
        const { state } = await getState({
          countryCode: 'AA',
        })
        expect(state.lastInitiatedAt).toBeDefined()
        expect(state.status).toEqual('assured')
        expect(state.access).toEqual('full')
      })
    })

    describe('V2 webhooks', () => {
      it('returns 400 if we fail to parse the external payload', async () => {
        const res = await kws.webhookV2({
          name: 'age-verified',
          time: new Date().toISOString(),
          orgId: crypto.randomUUID(),
          productId: crypto.randomUUID(),
          payload: {
            email: actor.email,
            externalPayload: serializeKWSExternalPayloadV2({
              version: KWSExternalPayloadVersion.V2,
              actorDid: actor.did,
              attemptId: crypto.randomUUID(),
              countryCode: 'AA',
            }),
            status: {
              verified: true,
              // @ts-ignore testing invalid payload
              verifiedMinimumAge: '18',
            },
          },
        })
        expect(res.status).toBe(400)
        await expect(res.json()).resolves.toHaveProperty(
          'error',
          'Failed to parse KWS webhook body',
        )
      })

      it('returns 400 if status is not verified', async () => {
        const res = await kws.webhookV2({
          name: 'age-verified',
          time: new Date().toISOString(),
          orgId: crypto.randomUUID(),
          productId: crypto.randomUUID(),
          payload: {
            email: actor.email,
            externalPayload: serializeKWSExternalPayloadV2({
              version: KWSExternalPayloadVersion.V2,
              actorDid: actor.did,
              attemptId: crypto.randomUUID(),
              countryCode: 'AA',
            }),
            status: {
              verified: false,
              verifiedMinimumAge: 18,
            },
          },
        })
        expect(res.status).toBe(400)
        await expect(res.json()).resolves.toHaveProperty(
          'error',
          'Expected KWS webhook to have verified status',
        )
      })

      it('returns 200, but AA state unchanged due to invalid region', async () => {
        const res = await kws.webhookV2({
          name: 'age-verified',
          time: new Date().toISOString(),
          orgId: crypto.randomUUID(),
          productId: crypto.randomUUID(),
          payload: {
            email: actor.email,
            externalPayload: serializeKWSExternalPayloadV2({
              version: KWSExternalPayloadVersion.V2,
              actorDid: actor.did,
              attemptId: crypto.randomUUID(),
              countryCode: 'XX',
            }),
            status: {
              verified: true,
              verifiedMinimumAge: 18,
            },
          },
        })
        await network.processAll()
        expect(res.status).toBe(200)
        const { state } = await getState({
          countryCode: 'XX',
        })
        expect(state.status).toEqual('unknown') // we never began, so it's still unknown
      })

      it('success', async () => {
        await beginAgeAssurance({
          countryCode: 'AA',
        })
        await network.processAll()
        await kws.webhookV2({
          name: 'age-verified',
          time: new Date().toISOString(),
          orgId: crypto.randomUUID(),
          productId: crypto.randomUUID(),
          payload: {
            email: actor.email,
            externalPayload: serializeKWSExternalPayloadV2({
              version: KWSExternalPayloadVersion.V2,
              actorDid: actor.did,
              attemptId: crypto.randomUUID(),
              countryCode: 'AA',
            }),
            status: {
              verified: true,
              verifiedMinimumAge: 18,
            },
          },
        })
        await network.processAll()
        const { state } = await getState({
          countryCode: 'AA',
        })
        expect(state.lastInitiatedAt).toBeDefined()
        expect(state.status).toEqual('assured')
        expect(state.access).toEqual('full')
      })
    })

    describe('V1 compat', () => {
      it('works via webhook', async () => {
        await beginAgeAssurance({
          countryCode: 'BB',
        })
        await network.processAll()
        await kws.webhookV1({
          payload: {
            externalPayload: serializeKWSExternalPayloadV2({
              version: KWSExternalPayloadVersion.V2,
              actorDid: actor.did,
              attemptId: crypto.randomUUID(),
              countryCode: 'BB',
            }),
            status: {
              verified: true,
            },
          },
        })
        await network.processAll()
        const { state } = await getState({
          countryCode: 'BB',
        })
        expect(state.lastInitiatedAt).toBeDefined()
        expect(state.status).toEqual('assured')
        expect(state.access).toEqual('full')
      })

      it('works via redirect', async () => {
        await beginAgeAssurance({
          countryCode: 'BB',
        })
        await network.processAll()
        await kws.redirectV1({
          externalPayload: serializeKWSExternalPayloadV2({
            version: KWSExternalPayloadVersion.V2,
            actorDid: actor.did,
            attemptId: crypto.randomUUID(),
            countryCode: 'BB',
          }),
          status: JSON.stringify({
            verified: true,
          }),
        })
        await network.processAll()
        const { state } = await getState({
          countryCode: 'BB',
        })
        expect(state.lastInitiatedAt).toBeDefined()
        expect(state.status).toEqual('assured')
        expect(state.access).toEqual('full')
      })
    })
  })

  describe('misc', () => {
    /*
     * This is a silly test, but it did help me uncover a local data-plane
     * implementation bug. Let's leave it here for additional safety.
     */
    it('expects access to be safe', async () => {
      await kws.redirectV2({
        externalPayload: serializeKWSExternalPayloadV2({
          version: KWSExternalPayloadVersion.V2,
          actorDid: actor.did,
          attemptId: crypto.randomUUID(),
          countryCode: 'AA',
        }),
        status: serializeKWSAgeVerifiedStatus({
          verified: true,
          verifiedMinimumAge: 16,
        }),
      })
      await network.processAll()
      const { state } = await getState({
        countryCode: 'AA',
      })
      expect(state.status).toEqual('assured')
      expect(state.access).toEqual('safe')
    })

    /**
     * We only block re-init if the user is in a `blocked` state, which is not
     * testable using the local dataplane at the moment. The test below
     * reflects v1 handling.
     *
     * Skipping for now, but this handling is implemented in v2.
     */
    it.skip('cannot re-init from terminal state', async () => {
      await kws.redirectV2({
        externalPayload: serializeKWSExternalPayloadV2({
          version: KWSExternalPayloadVersion.V2,
          actorDid: actor.did,
          attemptId: crypto.randomUUID(),
          countryCode: 'AA',
        }),
        status: serializeKWSAgeVerifiedStatus({
          verified: true,
          verifiedMinimumAge: 18,
        }),
      })
      await network.processAll()
      const call = beginAgeAssurance({
        countryCode: 'AA',
      })
      await expect(call).rejects.toHaveProperty('error', 'InvalidInitiation')
    })

    it('re-init from terminal state retains existing status', async () => {
      await kws.redirectV2({
        externalPayload: serializeKWSExternalPayloadV2({
          version: KWSExternalPayloadVersion.V2,
          actorDid: actor.did,
          attemptId: crypto.randomUUID(),
          countryCode: 'AA',
        }),
        status: serializeKWSAgeVerifiedStatus({
          verified: true,
          verifiedMinimumAge: 16,
        }),
      })
      await network.processAll()
      const { state } = await getState({
        countryCode: 'AA',
      })
      expect(state.status).toEqual('assured')
      expect(state.access).toEqual('safe')
      const res = await beginAgeAssurance({
        countryCode: 'AA',
      })
      expect(res.status).toEqual('assured')
      expect(res.access).toEqual('safe')
    })

    /*
     * This tests local dataplane behavior, but the actual prod implementation
     * lives in the dataplane repo, obviously.
     */
    it('dataplane converts v1 to v2 state at read time', async () => {
      await beginAgeAssurance({
        countryCode: 'BB',
      })
      await network.processAll()
      await kws.webhookV1({
        payload: {
          externalPayload: serializeKWSExternalPayloadV1({
            actorDid: actor.did,
            attemptId: crypto.randomUUID(),
          }),
          status: {
            verified: true,
          },
        },
      })
      await network.processAll()
      const { state } = await getState({
        countryCode: 'BB',
      })
      expect(state.lastInitiatedAt).toBeDefined()
      expect(state.status).toEqual('assured')
      expect(state.access).toEqual('full')
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
      ageAssuranceAccess: null,
      ageAssuranceCountryCode: null,
      ageAssuranceRegionCode: null,
    })
    .execute()
}

class MockKwsServer {
  verificationSecret = 'verificationSecret' // unused here
  webhookSecret = 'webhookSecret' // unused here
  ageVerifiedWebhookSecret = 'ageVerifiedWebhookSecret'
  ageVerifiedRedirectSecret = 'ageVerifiedRedirectSecret'

  private app: Application
  private server: Server
  private bskyUrlBase = ''

  constructor({
    oauthMock,
    sendAgeVerifiedFlowEmailMock,
    sendAdultVerifiedFlowEmailMock,
  }: {
    oauthMock: jest.Mock
    sendAgeVerifiedFlowEmailMock: jest.Mock
    sendAdultVerifiedFlowEmailMock: jest.Mock
  }) {
    this.app = express()
      .use(json())
      .post('/auth/realms/kws/protocol/openid-connect/token', (_, res) =>
        oauthMock(_, res),
      )
      .post('/v1/verifications/send-email', (req, res) => {
        const body = req.body
        if (body.userContext === 'age') {
          return sendAgeVerifiedFlowEmailMock(req, res)
        } else if (body.userContext === 'adult') {
          return sendAdultVerifiedFlowEmailMock(req, res)
        }
      })

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

  setBskyBaseUrl(url: string) {
    this.bskyUrlBase = url
  }

  redirectV1({
    externalPayload,
    status,
  }: {
    externalPayload: string
    status: string
  }) {
    const sig = crypto
      .createHmac('sha256', this.verificationSecret)
      .update(`${status}:${externalPayload}`)
      .digest('hex')

    const queryString = new URLSearchParams({
      externalPayload,
      signature: sig,
      status,
    }).toString()

    return fetch(
      `${this.bskyUrlBase}/external/kws/age-assurance-verification?${queryString}`,
      {
        method: 'GET',
        redirect: 'manual',
      },
    )
  }

  redirectV2({
    externalPayload,
    status,
  }: {
    externalPayload: string
    status: string
  }) {
    const sig = crypto
      .createHmac('sha256', this.ageVerifiedRedirectSecret)
      .update(`${status}:${externalPayload}`)
      .digest('hex')

    const queryString = new URLSearchParams({
      externalPayload,
      signature: sig,
      status,
    }).toString()

    return fetch(
      `${this.bskyUrlBase}/external/age-assurance/redirects/kws-age-verified?${queryString}`,
      {
        method: 'GET',
        redirect: 'manual',
      },
    )
  }

  webhookV1(
    body: Omit<KwsWebhookBody, 'payload'> & {
      payload: Omit<KwsWebhookBody['payload'], 'externalPayload'> & {
        externalPayload: string
      }
    },
  ): Promise<Response> {
    const bodyBuffer = Buffer.from(JSON.stringify(body))

    const timestamp = new Date().valueOf()
    const sig = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${bodyBuffer}`)
      .digest('hex')

    return fetch(`${this.bskyUrlBase}/external/kws/age-assurance-webhook`, {
      method: 'POST',
      body: bodyBuffer,
      headers: {
        'x-kws-signature': `t=${timestamp},v1=${sig}`,
        'Content-Type': 'application/json',
      },
    })
  }

  webhookV2(body: KWSWebhookAgeVerified): Promise<Response> {
    const bodyBuffer = Buffer.from(JSON.stringify(body))

    const timestamp = new Date().valueOf()
    const sig = crypto
      .createHmac('sha256', this.ageVerifiedWebhookSecret)
      .update(`${timestamp}.${bodyBuffer}`)
      .digest('hex')

    return fetch(
      `${this.bskyUrlBase}/external/age-assurance/webhooks/kws-age-verified`,
      {
        method: 'POST',
        body: bodyBuffer,
        headers: {
          'x-kws-signature': `t=${timestamp},v1=${sig}`,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  get url() {
    const address = this.server.address() as AddressInfo
    return `http://localhost:${address.port}`
  }
}
