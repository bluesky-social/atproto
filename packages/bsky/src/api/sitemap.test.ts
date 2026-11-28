import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'
import { Timestamp } from '@bufbuild/protobuf'
import { Code, ConnectError } from '@connectrpc/connect'
import express from 'express'
import { describe, expect, it, test, vi } from 'vitest'
import type { AppContext } from '../context.js'
import type { DataPlaneClient } from '../data-plane/index.js'
import { SitemapPageType } from '../proto/bsky_pb.js'
import { createRouter } from './sitemap.js'

const SITEMAP_INDEX = '<?xml version="1.0" encoding="UTF-8"?><sitemapindex/>'
const SITEMAP_PAGE = '<?xml version="1.0" encoding="UTF-8"?><urlset/>'
const PAGE_DATE = Timestamp.fromDate(new Date(2025, 0, 1))

async function setup() {
  const getSitemapIndex = vi.fn<DataPlaneClient['getSitemapIndex']>(
    async () => ({ sitemap: gzipSync(SITEMAP_INDEX) }) as never,
  )
  const getSitemapPage = vi.fn<DataPlaneClient['getSitemapPage']>(
    async ({ date, bucket }) => {
      if (!PAGE_DATE.equals(new Timestamp(date)) || bucket !== 1) {
        throw new ConnectError('Sitemap page not found', Code.NotFound)
      }
      return { sitemap: gzipSync(SITEMAP_PAGE) } as never
    },
  )
  const ctx = {
    dataplane: { getSitemapIndex, getSitemapPage },
  } as unknown as AppContext
  const app = express()
  app.use(createRouter(ctx))
  const server = createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  return {
    getSitemapIndex,
    getSitemapPage,
    fetch: (path: string) => fetch(`http://127.0.0.1:${port}${path}`),
    [Symbol.asyncDispose]: () => server[Symbol.asyncDispose](),
  }
}

describe('sitemap router', () => {
  it('returns sitemap index', async () => {
    await using fixture = await setup()
    const response = await fixture.fetch('/external/sitemap/users.xml.gz')
    expect(response.status).toEqual(200)
    expect(response.headers.get('content-type')).toEqual('application/gzip')
    expect(response.headers.get('content-encoding')).toEqual('gzip')
    // @NOTE fetch decompresses the body because of the Content-Encoding header
    await expect(response.text()).resolves.toEqual(SITEMAP_INDEX)
    expect(fixture.getSitemapIndex).toHaveBeenCalledWith({
      type: SitemapPageType.USER,
    })
  })

  it('returns sitemap page', async () => {
    await using fixture = await setup()
    const response = await fixture.fetch(
      '/external/sitemap/users/2025-01-01/1.xml.gz',
    )
    expect(response.status).toEqual(200)
    expect(response.headers.get('content-type')).toEqual('application/gzip')
    expect(response.headers.get('content-encoding')).toEqual('gzip')
    await expect(response.text()).resolves.toEqual(SITEMAP_PAGE)
    expect(fixture.getSitemapPage).toHaveBeenCalledOnce()
    const [req] = fixture.getSitemapPage.mock.calls[0]
    expect(req.type).toBe(SitemapPageType.USER)
    expect(req.bucket).toBe(1)
    expect(req.date).toEqual(PAGE_DATE)
  })

  test.each([
    { note: 'invalid date format', path: 'invalid-date/1' },
    { note: 'invalid bucket number', path: '2025-01-01/0' },
    { note: 'non-numeric bucket', path: '2025-01-01/abc' },
  ])('returns 400 for $note', async ({ path }) => {
    await using fixture = await setup()
    const response = await fixture.fetch(
      `/external/sitemap/users/${path}.xml.gz`,
    )
    expect(response.status).toEqual(400)
    expect(fixture.getSitemapPage).not.toHaveBeenCalled()
  })

  it('returns 404 for non-existent sitemap page', async () => {
    await using fixture = await setup()
    const response = await fixture.fetch(
      '/external/sitemap/users/2024-01-01/1.xml.gz',
    )
    expect(response.status).toEqual(404)
  })
})
