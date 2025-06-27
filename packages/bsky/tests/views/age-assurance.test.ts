import { once } from 'node:events'
import { Server, createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import express, { Application } from 'express'
import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'

describe('age assurance views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  let kwsServer: MockKwsServer
  let kwsAuthMock: jest.Mock
  let kwsSendEmailMock: jest.Mock

  beforeAll(async () => {
    kwsAuthMock = jest.fn(() => ({ access_token: 'access_token' }))
    kwsSendEmailMock = jest.fn()
    kwsServer = new MockKwsServer({
      authMock: kwsAuthMock,
      sendEmailMock: kwsSendEmailMock,
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
          webhookSigningKey: 'webhookSigningKey',
        },
      },
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()

    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
    await kwsServer.stop()
  })

  it('fetches AA state correctly if user never did the flow', async () => {
    const { data: aliceState } =
      await agent.app.bsky.unspecced.getAgeAssuranceState(
        {},
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyUnspeccedGetAgeAssuranceState,
          ),
        },
      )

    expect(aliceState).toEqual({
      status: 'unknown',
    })
  })

  it('works with KWS verification response flow', async () => {
    const { data: aliceState0 } =
      await agent.app.bsky.unspecced.initAgeAssurance(
        { email: sc.accounts[alice].email, language: 'en' },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyUnspeccedInitAgeAssurance,
          ),
        },
      )

    expect(aliceState0).toEqual({
      status: 'pending',
      lastInitiatedAt: expect.any(String),
    })
    expect(kwsSendEmailMock).toHaveBeenCalledTimes(1)

    const { data: aliceState1 } =
      await agent.app.bsky.unspecced.getAgeAssuranceState(
        {},
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyUnspeccedGetAgeAssuranceState,
          ),
        },
      )

    expect(aliceState1).toStrictEqual(aliceState0)

    // @TODO: call response from KWS server
  })
})

class MockKwsServer {
  app: Application
  server: Server

  constructor({
    authMock,
    sendEmailMock,
  }: {
    authMock: jest.Mock
    sendEmailMock: jest.Mock
  }) {
    this.app = express()
      .post('/auth/realms/kws/protocol/openid-connect/token', (req, res) => {
        res.statusCode = 200
        return res.json(authMock(req, res))
      })
      .post('/verifications/send-email', (req, res) => {
        res.statusCode = 200
        return res.json(sendEmailMock(req, res))
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

  get url() {
    const address = this.server.address() as AddressInfo
    return `http://localhost:${address.port}`
  }
}
