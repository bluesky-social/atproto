import { once } from 'node:events'
import { AddressInfo } from 'node:net'
import { finished } from 'node:stream/promises'
import express from 'express'
import { request } from 'undici'
import { TestNetwork, basicSeed } from '@atproto/dev-env'
import { handler as errorHandler } from '../src/error'
import { startServer } from './_util'

describe('server', () => {
  let network: TestNetwork
  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_server',
    })
    const sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  it('preserves 404s.', async () => {
    const response = await fetch(`${network.bsky.url}/unknown`)
    expect(response.status).toEqual(404)
  })

  it('error handler turns unknown errors into 500s.', async () => {
    const app = express()
    app.get('/oops', () => {
      throw new Error('Oops!')
    })
    app.use(errorHandler)
    const { origin, stop } = await startServer(app)
    try {
      const response = await fetch(new URL(`/oops`, origin))
      expect(response.status).toEqual(500)
      await expect(response.json()).resolves.toEqual({
        error: 'InternalServerError',
        message: 'Internal Server Error',
      })
    } finally {
      await stop()
    }
  })

  it('healthcheck succeeds when database is available.', async () => {
    const response = await fetch(`${network.bsky.url}/xrpc/_health`)
    expect(response.status).toEqual(200)
    await expect(response.json()).resolves.toEqual({ version: 'unknown' })
  })

  // TODO(bsky) check on a different endpoint that accepts json, currently none.
  it.skip('limits size of json input.', async () => {
    const response = await fetch(
      `${network.bsky.url}/xrpc/com.atproto.repo.createRecord`,
      {
        method: 'POST',
        body: '"' + 'x'.repeat(150 * 1024) + '"', // ~150kb
        headers: { 'Content-Type': 'application/json' },
      },
    )

    expect(response.status).toEqual(413)
    await expect(response.json()).resolves.toEqual({
      error: 'PayloadTooLargeError',
      message: 'request entity too large',
    })
  })

  it('compresses large json responses', async () => {
    const res = await request(
      `${network.bsky.url}/xrpc/app.bsky.feed.getTimeline`,
      {
        headers: {
          ...(await network.serviceHeaders(alice, 'app.bsky.feed.getTimeline')),
          'accept-encoding': 'gzip',
        },
      },
    )

    await finished(res.body.resume())

    expect(res.headers['content-encoding']).toEqual('gzip')
  })

  it('does not compress small payloads', async () => {
    const res = await request(`${network.bsky.url}/xrpc/_health`, {
      headers: { 'accept-encoding': 'gzip' },
    })

    await finished(res.body.resume())

    expect(res.headers['content-encoding']).toBeUndefined()
  })

  it('healthcheck fails when dataplane is unavailable.', async () => {
    const { port } = network.bsky.dataplane.server.address() as AddressInfo
    await network.bsky.dataplane.destroy()

    try {
      const response = await fetch(`${network.bsky.url}/xrpc/_health`)
      expect(response.status).toEqual(503)
      await expect(response.json()).resolves.toEqual({
        version: 'unknown',
        error: 'Service Unavailable',
      })
    } finally {
      // restart dataplane server to allow test suite to cleanup
      network.bsky.dataplane.server.listen(port)
      await once(network.bsky.dataplane.server, 'listening')
    }
  })
})
