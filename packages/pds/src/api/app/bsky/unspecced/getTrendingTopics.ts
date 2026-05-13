/**
 * Override for getTrendingTopics.
 * Pulls topics + suggested feeds from the admin backend. On any failure
 * (missing URL, non-2xx, network error, malformed body) returns empty
 * arrays so the endpoint never fails loudly.
 */
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import type { TrendingTopic } from '../../../../lexicon/types/app/bsky/unspecced/defs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTrendingTopics({
    handler: async () => {
      let topics: TrendingTopic[] = []
      let suggested: TrendingTopic[] = []
      const wadminUrl = ctx.cfg.wadmin.url
      if (wadminUrl) {
        try {
          const res = await fetch(`${wadminUrl}/api/wsocial/trending-topics`)
          if (res.ok) {
            const data = (await res.json()) as {
              topics?: TrendingTopic[]
              suggested?: TrendingTopic[]
            }
            if (Array.isArray(data.topics)) topics = data.topics
            if (Array.isArray(data.suggested)) suggested = data.suggested
          }
        } catch {
          // fall through to empty
        }
      }
      return {
        encoding: 'application/json' as const,
        body: { topics, suggested },
      }
    },
  })
}
