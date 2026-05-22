import * as jose from 'jose'
import { once } from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import * as plc from '@did-plc/lib'
import express from 'express'
import AtpAgent from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { LexiconDocument } from '@atproto/lex-document'

// Slice D regression test for proxy.serviceAuthCombinedAud.
//
// When the flag is off (default), the PDS catchall proxyHandler issues
// service-auth JWTs whose `aud` claim is the bare DID. When the flag is
// on, the JWT's `aud` claim is the combined `did#serviceId` form. The
// scope check in the authorize callback always uses the combined form
// (Slice A); only the JWT side is flag-controlled.
//
// We exercise the catchall via an unregistered custom lexicon, mirroring
// the pattern in proxy-catchall.test.ts.

const lexicons = [
  {
    lexicon: 1,
    id: 'com.example.ok',
    defs: {
      main: {
        type: 'query',
        output: {
          encoding: 'application/json',
          schema: { type: 'object', properties: { foo: { type: 'string' } } },
        },
      },
    },
  },
] as const satisfies LexiconDocument[]

describe('proxy aud flag', () => {
  let network: TestNetworkNoAppView
  let alice: AtpAgent
  let proxyServer: ProxyServer

  afterEach(async () => {
    if (proxyServer) await proxyServer.close()
    if (network) await network.close()
  })

  it('issues bare-DID aud when flag is off (default)', async () => {
    await setup({})

    await alice.call('com.example.ok')

    const req = proxyServer.requests.at(-1)
    expect(req?.auth).toBeDefined()
    const decoded = jose.decodeJwt(req!.auth!.replace('Bearer ', ''))
    expect(decoded.aud).toBe(proxyServer.did)
  })

  it('issues combined did#serviceId aud when flag is on', async () => {
    await setup({ proxyServiceAuthCombinedAud: true })

    await alice.call('com.example.ok')

    const req = proxyServer.requests.at(-1)
    expect(req?.auth).toBeDefined()
    const decoded = jose.decodeJwt(req!.auth!.replace('Bearer ', ''))
    expect(decoded.aud).toBe(`${proxyServer.did}#proxy_test`)
  })

  async function setup(pdsConfig: { proxyServiceAuthCombinedAud?: boolean }) {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: pdsConfig.proxyServiceAuthCombinedAud
        ? 'proxy_aud_flag_on'
        : 'proxy_aud_flag_off',
      pds: pdsConfig,
    })
    const serviceId = 'proxy_test'
    proxyServer = await ProxyServer.create(
      network.pds.ctx.plcClient,
      network.pds.ctx.plcRotationKey,
      serviceId,
    )
    alice = network.pds.getAgent().withProxy(serviceId, proxyServer.did)
    for (const lex of lexicons) alice.lex.add(lex)
    await alice.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
  }
})

type ProxyReq = { url: string; auth: string | undefined }

class ProxyServer {
  constructor(
    public server: http.Server,
    public url: string,
    public did: string,
    public requests: ProxyReq[],
  ) {}

  static async create(
    plcClient: plc.Client,
    keypair: Keypair,
    serviceId: string,
  ): Promise<ProxyServer> {
    const requests: ProxyReq[] = []
    const app = express()
    app.all('*', (req, res) => {
      requests.push({ url: req.url, auth: req.header('authorization') })
      res.status(200).json({ foo: 'ok' })
    })
    const server = app.listen(0)
    await once(server, 'listening')
    const { port } = server.address() as AddressInfo
    const url = `http://localhost:${port}`
    const plcOp = await plc.signOperation(
      {
        type: 'plc_operation',
        rotationKeys: [keypair.did()],
        alsoKnownAs: [],
        verificationMethods: {},
        services: {
          [serviceId]: { type: 'TestAtprotoService', endpoint: url },
        },
        prev: null,
      },
      keypair,
    )
    const did = await plc.didForCreateOp(plcOp)
    await plcClient.sendOperation(did, plcOp)
    return new ProxyServer(server, url, did, requests)
  }

  close(): Promise<void> {
    return new Promise<void>((resolve) => this.server.close(() => resolve()))
  }
}
