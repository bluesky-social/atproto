import { Client } from '@atproto/lex'
import {
  UpstreamFailureError,
  UpstreamTimeoutError,
} from '@atproto/xrpc-server'
import { fetchMaxSizeProcessor } from '@atproto-labs/fetch-node'
import { app } from '../lexicons/index.js'

const MAX_RESPONSE_BYTES = 512 * 1024
const TIMEOUT_MS = 5000

const capDecodedSize = fetchMaxSizeProcessor(MAX_RESPONSE_BYTES)

/**
 * Fetches Iris's ordered Atmosphere Explore article skeleton with a deadline,
 * decoded-size cap, no redirects, and response validation, without altering
 * the shared Iris client.
 */
export async function fetchAtmosphereArticleRecommendations(
  client: Client,
  params: app.bsky.unspecced.getAtmosphereExploreArticleRecommendations.$Params,
  options: { headers: Record<string, string>; signal: AbortSignal },
): Promise<app.bsky.unspecced.getAtmosphereExploreArticleRecommendations.$OutputBody> {
  const signal = AbortSignal.any([
    options.signal,
    AbortSignal.timeout(TIMEOUT_MS),
  ])
  const bounded = boundedClient(client)
  let output: app.bsky.unspecced.getAtmosphereExploreArticleRecommendations.$OutputBody
  try {
    output = await bounded.call(
      app.bsky.unspecced.getAtmosphereExploreArticleRecommendations,
      params,
      { headers: options.headers, signal },
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
  if (output.articles.length > params.limit) {
    throw new UpstreamFailureError(
      'Atmosphere Explore article recommendations exceeded the requested limit',
    )
  }
  return output
}

function boundedClient(client: Client): Client {
  const { xrpcDefaults } = client
  return new Client(
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
      validateResponse: true,
    },
  )
}

function isTimeoutOrAbort(err: unknown): boolean {
  for (let depth = 0; err instanceof Error && depth < 5; depth++) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return true
    err = err.cause
  }
  return false
}
