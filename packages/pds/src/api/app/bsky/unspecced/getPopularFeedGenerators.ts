/**
 * Override for getPopularFeedGenerators.
 * Pulls hydrated GeneratorViews from the wadmin backend, forwarding
 * `limit`, `cursor`, and `query` so the search/pagination is handled
 * upstream. On any failure (missing URL, timeout, non-2xx, network error,
 * malformed body) returns an empty array so the endpoint never fails loudly.
 */
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import type { GeneratorView } from '../../../../lexicon/types/app/bsky/feed/defs'

const WADMIN_FETCH_TIMEOUT_MS = 5000

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopularFeedGenerators({
    handler: async ({ params }) => {
      let feeds: GeneratorView[] = []
      let cursor: string | undefined
      const wadminUrl = ctx.cfg.wadmin.url
      if (wadminUrl) {
        const url = new URL(`${wadminUrl}/api/wsocial/feeds`)
        url.searchParams.set('limit', String(params.limit))
        if (params.cursor) url.searchParams.set('cursor', params.cursor)
        if (params.query) url.searchParams.set('query', params.query)
        try {
          const res = await fetch(url, {
            signal: AbortSignal.timeout(WADMIN_FETCH_TIMEOUT_MS),
          })
          if (res.ok) {
            const data = (await res.json()) as {
              feeds?: GeneratorView[]
              cursor?: string
            }
            if (Array.isArray(data.feeds)) feeds = data.feeds
            if (typeof data.cursor === 'string') cursor = data.cursor
          }
        } catch {
          // fall through to empty
        }
      }
      return {
        encoding: 'application/json' as const,
        body: { feeds, cursor },
      }
    },
  })
}
