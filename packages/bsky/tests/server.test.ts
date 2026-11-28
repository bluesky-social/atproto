import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { finished } from 'node:stream/promises'
import { request } from 'undici'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { TestNetwork, basicSeed } from '@atproto/dev-env'

describe('server', () => {
  let network: TestNetwork
  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_server',
    })
    const sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  it('preserves 404s.', async () => {
    const response = await fetch(`${network.bsky.url}/unknown`)
    expect(response.status).toEqual(404)
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
    const { server } = network.bsky.dataplane
    const { port } = server.address() as AddressInfo
    // @NOTE Not dataplane.destroy(): its terminator only runs once, so the
    // restarted server would be left listening when the network closes.
    server.close()
    server.closeAllConnections()
    await once(server, 'close')

    try {
      const response = await fetch(`${network.bsky.url}/xrpc/_health`)
      expect(response.status).toEqual(503)
      await expect(response.json()).resolves.toEqual({
        version: 'unknown',
        error: 'Service Unavailable',
      })
    } finally {
      // restart dataplane server to allow test suite to cleanup
      server.listen(port)
      await once(server, 'listening')
    }
  })
})
