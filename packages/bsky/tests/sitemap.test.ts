import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestNetwork, createTestFetch } from '@atproto/dev-env'

describe('sitemap', () => {
  let network: TestNetwork

  // Route requests through a pooled, non-keep-alive fetch so this suite doesn't
  // leave idle connections open that would block server shutdown. (The
  // `connection: close` header has no effect here: `connection` is a forbidden
  // header name that undici silently drops.)
  const fetch = createTestFetch()

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_sitemap',
    })
  })

  afterAll(async () => {
    await network?.close()
    await fetch.destroy()
  })

  it('returns sitemap index', async () => {
    const response = await fetch(
      `${network.bsky.url}/external/sitemap/users.xml.gz`,
    )
    expect(response.status).toEqual(200)
    expect(response.headers.get('content-type')).toEqual('application/gzip')
    expect(response.headers.get('content-encoding')).toEqual('gzip')

    // fetch automatically decompresses gzip when Content-Encoding is set
    const xml = await response.text()

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<sitemapindex')
    expect(xml).toContain('</sitemapindex>')
  })

  it('returns sitemap page', async () => {
    const response = await fetch(
      `${network.bsky.url}/external/sitemap/users/2025-01-01/1.xml.gz`,
    )
    expect(response.status).toEqual(200)
    expect(response.headers.get('content-type')).toEqual('application/gzip')
    expect(response.headers.get('content-encoding')).toEqual('gzip')

    // fetch automatically decompresses gzip when Content-Encoding is set
    const xml = await response.text()

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset')
    expect(xml).toContain('</urlset>')
  })

  it('returns 400 for invalid date format', async () => {
    const response = await fetch(
      `${network.bsky.url}/external/sitemap/users/invalid-date/1.xml.gz`,
    )
    expect(response.status).toEqual(400)
  })

  it('returns 400 for invalid bucket number', async () => {
    const response = await fetch(
      `${network.bsky.url}/external/sitemap/users/2025-01-01/0.xml.gz`,
    )
    expect(response.status).toEqual(400)
  })

  it('returns 400 for non-numeric bucket', async () => {
    const response = await fetch(
      `${network.bsky.url}/external/sitemap/users/2025-01-01/abc.xml.gz`,
    )
    expect(response.status).toEqual(400)
  })

  it('returns 404 for non-existent sitemap page', async () => {
    const response = await fetch(
      `${network.bsky.url}/external/sitemap/users/2024-01-01/1.xml.gz`,
    )
    expect(response.status).toEqual(404)
  })
})
