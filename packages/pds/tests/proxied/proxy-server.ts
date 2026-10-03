import { once } from 'node:events'
import type http from 'node:http'
import type { AddressInfo } from 'node:net'
import * as plc from '@did-plc/lib'
import express from 'express'
import { type HttpTerminator, createHttpTerminator } from 'http-terminator'
import { type Keypair, Secp256k1Keypair } from '@atproto/crypto'
import type { DidString } from '@atproto/syntax'

export type ProxyReq = {
  url: string
  auth: string | undefined
}

export type ProxyServerOptions = {
  /**
   * When set, requests are forwarded to this URL and the upstream response is
   * relayed back, so the server can stand in for another service (e.g. as an
   * alternate app view). Otherwise every request is answered with 200. May be
   * assigned after the server is listening.
   */
  upstream?: string
}

/**
 * An HTTP service registered on the test PLC under its own DID, so it can be
 * named in an `atproto-proxy` header. Every request it receives is recorded.
 */
export class ProxyServer {
  private terminator: HttpTerminator

  constructor(
    server: http.Server,
    public url: string,
    public did: DidString,
    public requests: ProxyReq[],
    public options: ProxyServerOptions,
    private plcOp: plc.Operation,
  ) {
    this.terminator = createHttpTerminator({ server })
  }

  /**
   * Start listening and derive the DID, without publishing it yet. Useful when
   * the DID must be known before the network it will be registered on exists.
   */
  static async listen(
    serviceId: string,
    options: ProxyServerOptions = {},
    keypair?: Keypair,
  ): Promise<ProxyServer> {
    const requests: ProxyReq[] = []
    const app = express()

    // This is a PDS endpoint which uses a manual pipethrough() in its handler
    app.get('/xrpc/app.bsky.actor.getPreferences', (req, res) => {
      res.sendStatus(501)
    })

    app.get('*', (req, res, next) => {
      requests.push({
        url: req.url,
        auth: req.header('authorization'),
      })
      if (!options.upstream) {
        res.sendStatus(200)
        return
      }
      forward(options.upstream, req, res).catch(next)
    })

    const server = app.listen(0)
    await once(server, 'listening')

    const { port } = server.address() as AddressInfo

    const url = `http://localhost:${port}`
    const rotationKey = keypair ?? (await Secp256k1Keypair.create())
    const plcOp = await plc.signOperation(
      {
        type: 'plc_operation',
        rotationKeys: [rotationKey.did()],
        alsoKnownAs: [],
        verificationMethods: {},
        services: {
          [serviceId]: {
            type: 'TestAtprotoService',
            endpoint: url,
          },
        },
        prev: null,
      },
      rotationKey,
    )
    const did = (await plc.didForCreateOp(plcOp)) as DidString
    return new ProxyServer(server, url, did, requests, options, plcOp)
  }

  static async create(
    plcClient: plc.Client,
    keypair: Keypair,
    serviceId: string,
    options: ProxyServerOptions = {},
  ): Promise<ProxyServer> {
    const server = await ProxyServer.listen(serviceId, options, keypair)
    await server.register(plcClient)
    return server
  }

  async register(plcClient: plc.Client): Promise<void> {
    await plcClient.sendOperation(this.did, this.plcOp)
  }

  async close(): Promise<void> {
    await this.terminator.terminate()
  }
}

const FORWARDED_REQUEST_HEADERS = [
  'authorization',
  'accept-language',
  'atproto-accept-labelers',
] as const

const SKIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
])

async function forward(
  upstream: string,
  req: express.Request,
  res: express.Response,
) {
  const headers: Record<string, string> = {}
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.header(name)
    if (value) headers[name] = value
  }
  const upstreamRes = await fetch(new URL(req.url, upstream), { headers })
  const body = Buffer.from(await upstreamRes.arrayBuffer())
  res.status(upstreamRes.status)
  upstreamRes.headers.forEach((value, name) => {
    if (!SKIPPED_RESPONSE_HEADERS.has(name)) res.setHeader(name, value)
  })
  res.send(body)
}
