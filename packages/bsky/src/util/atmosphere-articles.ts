import { Client, l } from '@atproto/lex'
import {
  UpstreamFailureError,
  UpstreamTimeoutError,
} from '@atproto/xrpc-server'
import { fetchMaxSizeProcessor } from '@atproto-labs/fetch-node'
import { app } from '../lexicons/index.js'

const MAX_RESPONSE_BYTES = 512 * 1024
const TIMEOUT_MS = 5000

const capDecodedSize = fetchMaxSizeProcessor(MAX_RESPONSE_BYTES)

// @NOTE Transport-only wrapper cache, keyed weakly by the shared Iris client
// (never mutated). Headers, params, and abort signals stay call-scoped.
const boundedClients = new WeakMap<Client, Client>()

type Article =
  app.bsky.unspecced.getAtmosphereExploreArticleRecommendations.Article

/** A best-effort normalization: the rec ID is absent unless Iris sent one. */
export type ArticleRecommendations = {
  articles: Article[]
  recIdStr?: string
}

const bodySchema = l.object({
  articles: l.optional(l.unknown()),
  recIdStr: l.optional(l.unknown()),
})

/**
 * Fetches Iris's ordered Atmosphere Explore article skeleton with a deadline,
 * decoded-size cap, and no redirects, without altering the shared Iris client.
 * Transport failures throw; a decoded body is normalized best-effort: only the
 * first `params.limit` articles are considered, malformed ones are dropped,
 * and an invalid rec ID is omitted.
 */
export async function fetchAtmosphereArticleRecommendations(
  client: Client,
  params: app.bsky.unspecced.getAtmosphereExploreArticleRecommendations.$Params,
  options: { headers: Record<string, string>; signal: AbortSignal },
): Promise<ArticleRecommendations> {
  const signal = AbortSignal.any([
    options.signal,
    AbortSignal.timeout(TIMEOUT_MS),
  ])
  const bounded = boundedClient(client)
  let output: unknown
  try {
    output = await bounded.call(
      app.bsky.unspecced.getAtmosphereExploreArticleRecommendations,
      params,
      { headers: options.headers, signal, validateResponse: false },
    )
  } catch (err) {
    // @NOTE Lex errors can wrap the abort reason, so the signals decide.
    if (signal.aborted || isTimeoutOrAbort(err)) {
      throw new UpstreamTimeoutError(
        'Atmosphere Explore article recommendations timed out',
      )
    }
    throw new UpstreamFailureError(
      'Atmosphere Explore article recommendations failed',
    )
  }
  return normalize(output, params.limit)
}

function normalize(output: unknown, limit: number): ArticleRecommendations {
  const body = bodySchema.safeParse(output)
  if (!body.success) return { articles: [] }
  const { articles, recIdStr } = body.value
  const result: ArticleRecommendations = {
    articles: Array.isArray(articles)
      ? articles.slice(0, limit).flatMap((entry) => {
          const article =
            app.bsky.unspecced.getAtmosphereExploreArticleRecommendations.article.$safeValidate(
              entry,
            )
          return article.success ? [article.value] : []
        })
      : [],
  }
  if (typeof recIdStr === 'string') result.recIdStr = recIdStr
  return result
}

function boundedClient(client: Client): Client {
  const cached = boundedClients.get(client)
  if (cached) return cached
  const { xrpcDefaults } = client
  const bounded = new Client(
    {
      get did() {
        return client.agent.did
      },
      async fetchHandler(path, init) {
        const response = await client.agent.fetchHandler(path, {
          ...init,
          redirect: 'error',
        })
        return capDecodedSize(response)
      },
    },
    {
      headers: client.headers,
      service: xrpcDefaults.service,
      labelers: xrpcDefaults.labelers,
      appLabelers: xrpcDefaults.appLabelers,
      validateRequest: xrpcDefaults.validateRequest,
      strictResponseProcessing: xrpcDefaults.strictResponseProcessing,
      validateResponse: xrpcDefaults.validateResponse,
    },
  )
  boundedClients.set(client, bounded)
  return bounded
}

function isTimeoutOrAbort(err: unknown): boolean {
  for (let depth = 0; err instanceof Error && depth < 5; depth++) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return true
    err = err.cause
  }
  return false
}
