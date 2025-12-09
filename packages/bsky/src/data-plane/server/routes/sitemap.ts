import { gzipSync } from 'node:zlib'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'

const MOCK_SITEMAP_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://bsky.app/sitemap/users/2025-01-01/1.xml.gz</loc>
  </sitemap>
</sitemapindex>`

const MOCK_SITEMAP_PAGE = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://bsky.app/profile/test.bsky.social</loc>
  </url>
</urlset>`

export default (): Partial<ServiceImpl<typeof Service>> => ({
  async getSitemapIndex() {
    return {
      sitemap: gzipSync(Buffer.from(MOCK_SITEMAP_INDEX)),
    }
  },
  async getSitemapPage() {
    return {
      sitemap: gzipSync(Buffer.from(MOCK_SITEMAP_PAGE)),
    }
  },
})
