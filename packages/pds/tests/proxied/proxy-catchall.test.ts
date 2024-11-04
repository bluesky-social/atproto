import AtpAgent from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { LexiconDoc } from '@atproto/lexicon'
import * as plc from '@did-plc/lib'
import express from 'express'
import { once } from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'

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
  {
    lexicon: 1,
    id: 'com.example.slow',
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
  {
    lexicon: 1,
    id: 'com.example.abort',
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
  {
    lexicon: 1,
    id: 'com.example.error',
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
] as const satisfies LexiconDoc[]

describe('proxy header', () => {
  let network: TestNetworkNoAppView
  let alice: AtpAgent

  let proxyServer: ProxyServer

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'proxy_catchall',
    })

    const serviceId = 'proxy_test'

    proxyServer = await ProxyServer.create(
      network.pds.ctx.plcClient,
      network.pds.ctx.plcRotationKey,
      serviceId,
    )

    alice = network.pds.getClient().withProxy(serviceId, proxyServer.did)

    for (const lex of lexicons) alice.lex.add(lex)

    await alice.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    await network.processAll()
  })

  afterAll(async () => {
    await proxyServer?.close()
    await network?.close()
  })

  it('rejects when upstream unavailable', async () => {
    const serviceId = 'foo_bar'

    const proxyServer = await ProxyServer.create(
      network.pds.ctx.plcClient,
      network.pds.ctx.plcRotationKey,
      serviceId,
    )

    // Make sure the service is not available
    await proxyServer.close()

    const client = alice.withProxy(serviceId, proxyServer.did)
    for (const lex of lexicons) client.lex.add(lex)

    await expect(client.call('com.example.ok')).rejects.toThrow(
      'Upstream service unreachable',
    )
  })

  it('successfully proxies requests', async () => {
    await expect(alice.call('com.example.ok')).resolves.toMatchObject({
      data: { foo: 'ok' },
      success: true,
    })
  })

  it('handles cancelled upstream requests', async () => {
    await expect(alice.call('com.example.abort')).rejects.toThrow('terminated')
  })

  it('handles failing upstream requests', async () => {
    await expect(alice.call('com.example.error')).rejects.toThrowError(
      expect.objectContaining({
        status: 502,
        error: 'FooBar',
        message: 'My message',
      }),
    )
  })

  it('handles cancelled downstream requests', async () => {
    const ac = new AbortController()

    setTimeout(() => ac.abort(), 20)

    await expect(
      alice.call('com.example.slow', {}, undefined, { signal: ac.signal }),
    ).rejects.toThrow('This operation was aborted')

    await expect(alice.call('com.example.slow')).resolves.toMatchObject({
      data: { foo: 'slow' },
      success: true,
    })
  })
})

class ProxyServer {
  constructor(
    private server: http.Server,
    public did: string,
  ) {}

  static async create(
    plcClient: plc.Client,
    keypair: Keypair,
    serviceId: string,
  ): Promise<ProxyServer> {
    const app = express()

    app.get('/xrpc/com.example.ok', (req, res) => {
      res.status(200)
      res.setHeader('content-type', 'application/json')
      res.send('{"foo":"ok"}')
    })

    app.get('/xrpc/com.example.slow', async (req, res) => {
      const wait = async (ms: number) => {
        if (res.destroyed) return
        const ac = new AbortController()
        const abort = () => ac.abort()
        res.on('close', abort)
        try {
          await sleep(ms, undefined, { signal: ac.signal })
        } finally {
          res.off('close', abort)
        }
      }

      await wait(50)

      res.status(200)
      res.setHeader('content-type', 'application/json')
      res.flushHeaders()

      await wait(50)

      for (const char of '{"foo":"slow"}') {
        res.write(char)
        await wait(10)
      }

      res.end()
    })

    app.get('/xrpc/com.example.abort', async (req, res) => {
      res.status(200)
      res.setHeader('content-type', 'application/json')
      res.write('{"foo"')
      await sleep(50)
      res.destroy(new Error('abort'))
    })

    app.get('/xrpc/com.example.error', async (req, res) => {
      res.status(500).json({ error: 'FooBar', message: 'My message' })
    })

    const server = app.listen(0)
    server.keepAliveTimeout = 30 * 1000
    server.headersTimeout = 35 * 1000
    await once(server, 'listening')
    const { port } = server.address() as AddressInfo

    const plcOp = await plc.signOperation(
      {
        type: 'plc_operation',
        rotationKeys: [keypair.did()],
        alsoKnownAs: [],
        verificationMethods: {},
        services: {
          [serviceId]: {
            type: 'TestAtprotoService',
            endpoint: `http://localhost:${port}`,
          },
        },
        prev: null,
      },
      keypair,
    )
    const did = await plc.didForCreateOp(plcOp)
    await plcClient.sendOperation(did, plcOp)
    return new ProxyServer(server, did)
  }

  async close() {
    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}
