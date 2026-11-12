import { mapDefined, noUndefinedVals } from '@atproto/common'
import { type DidString, l } from '@atproto/lex-schema'
import {
  ForbiddenError,
  MethodNotImplementedError,
  type Server,
  UpstreamFailureError,
  UpstreamTimeoutError,
} from '@atproto/xrpc-server'
import { safeFetchWrap } from '@atproto-labs/fetch-node'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'

const MAX_CONFIG_BYTES = 512 * 1024
const MAX_INPUT_ENTRIES = 100
const configSchema = l.object({ apps: l.optional(l.unknown()) })
const appDidSchema = l.optional(l.nullable(l.string({ format: 'did' })))
type AppCard = app.bsky.unspecced.getAtmosphereApps.AppCard
type AppEntry = { card: AppCard; did?: DidString }

export default function (server: Server, ctx: AppContext) {
  const fetchApps = createFetchApps()
  server.add(app.bsky.unspecced.getAtmosphereApps, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req, signal }) => {
      const viewer = auth.credentials.iss
      const features = ctx.featureGatesClient.scope(
        ctx.featureGatesClient.parseUserContextFromHandler({ viewer, req }),
      )
      if (!features.checkGate(features.Gate.AtmosphereScreenEndpointsEnable)) {
        throw new ForbiddenError('Atmosphere Explore is not enabled')
      }
      const service = ctx.cfg.atmosphereExploreTabService
      if (!service)
        throw new MethodNotImplementedError(
          'Atmosphere Explore service not configured',
        )
      let workerUrl: URL
      try {
        workerUrl = new URL(service)
      } catch {
        throw new UpstreamFailureError(
          'Unable to fetch Atmosphere Explore configuration',
        )
      }
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        labelers: ctx.reqLabelers(req),
        features,
        xrpcEndpoint: app.bsky.unspecced.getAtmosphereApps.$lxm,
      })
      const allApps = await fetchApps(workerUrl, signal)
      const apps =
        params.category === undefined
          ? allApps
          : allApps.filter(({ card }) => card.category === params.category)
      const dids = [...new Set(mapDefined(apps, ({ did }) => did))]
      const state = dids.length
        ? await ctx.hydrator.hydrateProfilesDetailed(dids, hydrateCtx, {
            knownFollowersDids: dids,
          })
        : { ctx: hydrateCtx }
      return {
        encoding: 'application/json',
        body: {
          apps: apps.map(({ card, did }) => {
            const profile = did
              ? ctx.views.profileDetailed(did, state)
              : undefined
            return {
              ...card,
              logo: profile?.avatar ?? card.logo,
              banner: profile?.banner ?? card.banner,
              profile,
            }
          }),
        },
      }
    },
  })
}

function createFetchApps() {
  // @NOTE The wrapper caps decoded response bytes, including compressed bodies.
  const fetchConfig = safeFetchWrap({
    timeout: 5000,
    responseMaxSize: MAX_CONFIG_BYTES,
  })

  return async function fetchApps(
    url: URL,
    signal: AbortSignal,
  ): Promise<AppEntry[]> {
    try {
      const response = await fetchConfig(url, {
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal,
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new UpstreamFailureError(
          `Atmosphere Explore service returned HTTP ${response.status}`,
        )
      }
      const config = configSchema.safeParse(await response.json())
      if (!config.success || !Array.isArray(config.value.apps)) return []
      return mapDefined(config.value.apps.slice(0, MAX_INPUT_ENTRIES), parseApp)
    } catch (err) {
      if (err instanceof UpstreamFailureError) throw err
      if (
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError')
      ) {
        throw new UpstreamTimeoutError('Atmosphere Explore request timed out')
      }
      throw new UpstreamFailureError(
        'Unable to fetch Atmosphere Explore configuration',
      )
    }
  }
}

const APP_CARD_FIELDS = [
  'id',
  'title',
  'description',
  'logo',
  'url',
  'category',
] as const

function parseApp(entry: unknown): AppEntry | undefined {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry))
    return
  const raw = entry as Record<string, unknown>
  const did = appDidSchema.safeParse(raw.did)
  if (!did.success) return
  // @NOTE Never trust upstream profile data; only the DID drives hydration.
  const card = app.bsky.unspecced.getAtmosphereApps.appCard.safeParse(
    noUndefinedVals({
      ...Object.fromEntries(APP_CARD_FIELDS.map((key) => [key, raw[key]])),
      banner: raw.backgroundImage,
    }),
  )
  if (!card.success) return
  return { card: card.value, did: did.value ?? undefined }
}
