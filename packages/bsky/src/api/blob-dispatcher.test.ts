import { once } from 'node:events'
import { createServer } from 'node:http'
import { request } from 'undici'
import { describe, expect, it } from 'vitest'
import type { ServerConfig } from '../config.js'
import { createBlobDispatcher } from './blob-dispatcher.js'

const createConfig = (proxyMaxRetries: number) =>
  ({
    disableSsrfProtection: true,
    proxyAllowHTTP2: false,
    proxyBodyTimeout: 30e3,
    proxyHeadersTimeout: 30e3,
    proxyMaxResponseSize: 10 * 1024 * 1024,
    proxyMaxRetries,
  }) as ServerConfig

async function getRequestCount(statusCode: number, proxyMaxRetries: number) {
  let requestCount = 0
  await using server = createServer((_req, res) => {
    requestCount += 1
    res.writeHead(statusCode).end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('Expected server to listen on a TCP port')
  }

  const dispatcher = createBlobDispatcher(createConfig(proxyMaxRetries))
  try {
    await expect(
      request(`http://127.0.0.1:${address.port}`, { dispatcher }),
    ).rejects.toMatchObject({ statusCode })
  } finally {
    await dispatcher.close()
  }

  return requestCount
}

describe(createBlobDispatcher, () => {
  it('does not retry 429 responses', async () => {
    expect(await getRequestCount(429, 3)).toBe(1)
  })

  it('retains the configured retry count for other statuses', async () => {
    expect(await getRequestCount(503, 2)).toBe(3)
  })
})
