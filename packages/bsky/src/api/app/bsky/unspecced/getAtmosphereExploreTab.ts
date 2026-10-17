import type { IncomingHttpHeaders } from 'node:http'
import { mapDefined, noUndefinedVals } from '@atproto/common'
import { type AtUriString, type Client, l } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import {
  MethodNotImplementedError,
  type Server,
  UpstreamFailureError,
  UpstreamTimeoutError,
} from '@atproto/xrpc-server'
import { safeFetchWrap } from '@atproto-labs/fetch-node'
import type { AppContext } from '../../../../context.js'
import type { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { app, site } from '../../../../lexicons/index.js'
import { httpLogger } from '../../../../logger.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline.js'
import { getAtprotoPassthroughHeaders } from '../../../../util/headers.js'
import type { Views } from '../../../../views/index.js'

const MAX_CONFIG_BYTES = 512 * 1024
const MAX_LIST_ITEMS = 10

const groupSchema = l.object({
  canonicalUri: l.optional(l.unknown()),
  startsAt: l.optional(l.nullable(l.string({ format: 'datetime' }))),
  endsAt: l.optional(l.nullable(l.string({ format: 'datetime' }))),
  tags: l.optional(l.array(l.string({ maxLength: 128 }), { maxLength: 100 })),
  locations: l.optional(
    l.array(l.string({ maxLength: 16 }), { maxLength: 100 }),
  ),
})
const bannerSchema = l.object({
  status: l.string({ maxLength: 128 }),
  startsAt: l.optional(l.nullable(l.string({ format: 'datetime' }))),
  endsAt: l.optional(l.nullable(l.string({ format: 'datetime' }))),
  locations: l.optional(
    l.array(l.string({ maxLength: 16 }), { maxLength: 100 }),
  ),
})
// Ingestion is best-effort per item: each section is an unvalidated value, and
// every entry is validated on its own so one bad entry never fails the rest.
const configSchema = l.object({
  announcementBanners: l.optional(l.unknown()),
  articles: l.optional(l.unknown()),
  publications: l.optional(l.unknown()),
  photos: l.optional(l.unknown()),
  livestreams: l.optional(l.unknown()),
  apps: l.optional(l.unknown()),
})
const MAX_INPUT_ENTRIES = 100

export default function (server: Server, ctx: AppContext) {
  const getExplore = createPipeline(skeleton, hydration, noRules, presentation)
  const fetchExploreTabSkeleton = createFetchExploreTabSkeleton()
  server.add(app.bsky.unspecced.getAtmosphereExploreTab, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req, signal }) => {
      const service = ctx.cfg.atmosphereExploreTabService
      if (!service)
        throw new MethodNotImplementedError(
          'Atmosphere Explore service not configured',
        )
      let workerUrl: URL
      try {
        // Location filtering happens locally, so fetch the full config as-is.
        workerUrl = new URL(service)
      } catch {
        throw new UpstreamFailureError(
          'Unable to fetch Atmosphere Explore configuration',
        )
      }
      const viewer = auth.credentials.iss
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        labelers: ctx.reqLabelers(req),
        features: ctx.featureGatesClient.scope(
          ctx.featureGatesClient.parseUserContextFromHandler({ viewer, req }),
        ),
        xrpcEndpoint: app.bsky.unspecced.getAtmosphereExploreTab.$lxm,
      })
      const useIris = hydrateCtx.features.checkGate(
        hydrateCtx.features.Gate.AtmosphereExploreArticlesIrisEnable,
      )
      // Use 501 instead of 500 as these are not considered retry-able by clients
      if (useIris && !ctx.irisClient)
        throw new MethodNotImplementedError('Iris agent not available')
      const result = await getExplore(
        {
          ...params,
          hydrateCtx,
          workerUrl,
          requestHeaders: req.headers,
          headers: noUndefinedVals({
            'accept-language': params.langs?.length
              ? params.langs.join(',')
              : req.headers['accept-language'],
            ...getAtprotoPassthroughHeaders(req),
          }),
          signal,
        },
        {
          hydrator: ctx.hydrator,
          views: ctx.views,
          irisClient: useIris ? ctx.irisClient : undefined,
          fetchExploreTabSkeleton,
        },
      )
      return { encoding: 'application/json', body: result }
    },
  })
}

async function skeleton({
  ctx,
  params,
}: SkeletonFnInput<Context, Params>): Promise<SkeletonState> {
  const [config, recommendations] = await Promise.all([
    ctx.fetchExploreTabSkeleton(params.workerUrl, params.signal),
    ctx.irisClient
      ? ctx.irisClient
          .call(
            app.bsky.unspecced.getAtmosphereExploreArticleRecommendations,
            {
              limit: MAX_LIST_ITEMS,
              viewer: params.hydrateCtx.viewer ?? undefined,
            },
            {
              headers: params.headers,
              signal: params.signal,
              validateResponse: true,
            },
          )
          // @NOTE Request and response-validation failures use curated articles.
          .catch((err) => {
            if (params.signal.aborted) throw err
            httpLogger.warn(
              { err },
              'Unable to fetch Atmosphere Explore article recommendations',
            )
            return undefined
          })
      : undefined,
  ])
  const now = Date.now()
  const announcementBanner = selectBanner(
    config.announcementBanners,
    params,
    now,
  )
  const select = createSelector(params, params.requestHeaders, now)
  return {
    now,
    announcementBanner,
    articles: orderGroups(
      recommendations && recommendations.articles.length > 0
        ? mapDefined(
            recommendations.articles.slice(0, MAX_LIST_ITEMS),
            ({ uri }) => {
              const root = recordUri(uri)
              return root &&
                new AtUri(root).collection === site.standard.document.$type
                ? { featured: false, uri: root }
                : undefined
            },
          )
        : completeGroups(select(config.articles)),
    ),
    articleRecIdStr: recommendations?.recIdStr,
    publications: orderGroups(completeGroups(select(config.publications))),
    photos: orderGroups(completeGroups(select(config.photos))),
    livestreams: orderGroups(completeGroups(select(config.livestreams))),
    // Apps have no hydration root or featured flag: keep worker order.
    apps: config.apps.slice(0, MAX_LIST_ITEMS),
  }
}

async function hydration({
  ctx,
  params,
  skeleton,
}: HydrationFnInput<Context, Params, SkeletonState>) {
  const uris = [
    ...new Set(
      [
        ...skeleton.articles,
        ...skeleton.publications,
        ...skeleton.photos,
        ...skeleton.livestreams,
      ].map(({ uri }) => uri),
    ),
  ]
  return ctx.hydrator.hydrateEmbedExternalViewFromUris(uris, params.hydrateCtx)
}

function presentation({
  ctx,
  skeleton,
  hydration: state,
}: PresentationFnInput<
  Context,
  Params,
  SkeletonState
>): app.bsky.unspecced.getAtmosphereExploreTab.$OutputBody {
  const { now, articles, publications, photos, livestreams } = skeleton
  return {
    announcementBanner: skeleton.announcementBanner,
    articles: {
      items: mapDefined(articles, ({ featured, uri }) => {
        const view = ctx.views.externalRecordView(uri, state, now)
        return view && app.bsky.embed.external.viewArticle.$isTypeOf(view)
          ? { featured, view }
          : undefined
      }),
      recIdStr: skeleton.articleRecIdStr,
    },
    publications: {
      items: mapDefined(publications, ({ featured, uri }) => {
        const view = ctx.views.externalRecordView(uri, state, now)
        return view &&
          app.bsky.embed.external.viewArticlePublication.$isTypeOf(view)
          ? { featured, view }
          : undefined
      }),
    },
    photos: {
      items: mapDefined(photos, ({ featured, uri }) => {
        const view = ctx.views.externalRecordView(uri, state, now)
        return view &&
          app.bsky.embed.external.viewGallery.$isTypeOf(view) &&
          view.items.length
          ? { featured, view }
          : undefined
      }),
    },
    livestreams: {
      items: mapDefined(livestreams, ({ featured, uri }) => {
        const view = ctx.views.externalRecordView(uri, state, now)
        return view && app.bsky.embed.external.viewLivestream.$isTypeOf(view)
          ? { featured, view }
          : undefined
      }),
    },
    apps: skeleton.apps,
  }
}

function createFetchExploreTabSkeleton() {
  // @NOTE The wrapper caps decoded response bytes, including compressed bodies.
  const fetchConfig = safeFetchWrap({
    timeout: 5000,
    responseMaxSize: MAX_CONFIG_BYTES,
  })

  return async function fetchExploreTabSkeleton(
    url: URL,
    signal: AbortSignal,
  ): Promise<ExploreConfig> {
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
      return normalizeConfig(await response.json())
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

type Group = l.Infer<typeof groupSchema>
type AppCard = app.bsky.unspecced.getAtmosphereExploreTab.AppCard
type ValidBanner = {
  banner: l.Infer<typeof bannerSchema>
  presentation: AnnouncementBanner
}
type ExploreConfig = {
  announcementBanners: ValidBanner[]
  articles: Group[]
  publications: Group[]
  photos: Group[]
  livestreams: Group[]
  apps: AppCard[]
}

/**
 * Keeps only the well-formed items of a successfully decoded worker body. Only
 * the first `MAX_INPUT_ENTRIES` entries of each section are examined, and
 * malformed entries are skipped whole, never coerced or repaired.
 */
function normalizeConfig(body: unknown): ExploreConfig {
  const raw = configSchema.safeParse(body)
  const config = raw.success ? raw.value : {}
  const entries = (value: unknown): unknown[] =>
    Array.isArray(value) ? value.slice(0, MAX_INPUT_ENTRIES) : []
  const valid = <T>(schema: l.Schema<T>, value: unknown): T[] =>
    entries(value).flatMap((entry) => {
      const result = schema.safeParse(entry)
      return result.success ? [result.value] : []
    })
  return {
    announcementBanners: entries(config.announcementBanners).flatMap(
      (entry) => {
        const banner = bannerSchema.safeParse(entry)
        const presentation =
          app.bsky.unspecced.getAtmosphereExploreTab.announcementBanner.$safeValidate(
            entry,
          )
        return banner.success && presentation.success
          ? [{ banner: banner.value, presentation: presentation.value }]
          : []
      },
    ),
    articles: valid(groupSchema, config.articles),
    publications: valid(groupSchema, config.publications),
    photos: valid(groupSchema, config.photos),
    livestreams: valid(groupSchema, config.livestreams),
    apps: valid(
      app.bsky.unspecced.getAtmosphereExploreTab.appCard,
      config.apps,
    ),
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  irisClient: Client | undefined
  fetchExploreTabSkeleton: ReturnType<typeof createFetchExploreTabSkeleton>
}

type Params = app.bsky.unspecced.getAtmosphereExploreTab.$Params & {
  hydrateCtx: HydrateCtx
  workerUrl: URL
  /** Recommendation headers for Iris only. */
  headers: Record<string, string>
  requestHeaders: IncomingHttpHeaders
  signal: AbortSignal
}

type RecordGroup = { featured: boolean; uri: AtUriString }

type SkeletonState = {
  now: number
  announcementBanner?: app.bsky.unspecced.getAtmosphereExploreTab.AnnouncementBanner
  articles: RecordGroup[]
  articleRecIdStr?: string
  publications: RecordGroup[]
  photos: RecordGroup[]
  livestreams: RecordGroup[]
  apps: app.bsky.unspecced.getAtmosphereExploreTab.AppCard[]
}

/**
 * Randomizes a selected list (Fisher-Yates), then places featured items ahead
 * of ordinary ones. Runs before hydration, so presentation keeps this order.
 */
function orderGroups(groups: RecordGroup[]): RecordGroup[] {
  const shuffled = [...groups]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return [
    ...shuffled.filter(({ featured }) => featured),
    ...shuffled.filter(({ featured }) => !featured),
  ].slice(0, MAX_LIST_ITEMS)
}

function completeGroups(groups: SelectedGroup[] = []): RecordGroup[] {
  return mapDefined(groups, ({ featured, canonicalUri }) => {
    const uri = recordUri(canonicalUri)
    if (!uri) return
    return { featured, uri }
  })
}

type AnnouncementBanner =
  app.bsky.unspecced.getAtmosphereExploreTab.AnnouncementBanner

/**
 * Returns the single (already validated) banner to show. Eligible (enabled, in window) banners targeted at a matching location
 * win, first in worker order; otherwise the unrestricted eligible banner with
 * the furthest-out `endsAt` (absent means no expiration; ties keep worker order).
 */
function selectBanner(
  banners: ValidBanner[],
  params: { countryCode?: string; regionCode?: string },
  now: number,
): AnnouncementBanner | undefined {
  let matched: AnnouncementBanner | undefined
  let fallback: AnnouncementBanner | undefined
  let fallbackEnd = -Infinity
  for (const { banner, presentation } of banners) {
    const { status, startsAt, endsAt, locations } = banner
    if (status !== 'enabled') continue
    if (startsAt != null && Date.parse(startsAt) > now) continue
    const end = endsAt == null ? Infinity : Date.parse(endsAt)
    if (end <= now) continue
    if (locations?.length) {
      if (!matched && matchesLocation(locations, params)) {
        matched = presentation
      }
    } else if (end > fallbackEnd) {
      fallback = presentation
      fallbackEnd = end
    }
  }
  const selected = matched ?? fallback
  if (!selected) return
  const { id, title, description, url, image, overlayColor, textColor } =
    selected
  return { id, title, description, url, image, overlayColor, textColor }
}

type Selectable = {
  tags?: string[]
  locations?: string[]
  startsAt?: string | null
  endsAt?: string | null
}
type SelectedGroup = l.Infer<typeof groupSchema> & { featured: boolean }

/**
 * Builds a per-list selector that drops location-ineligible entries, orders
 * the rest by priority bucket (location, requested topic, `general`, untagged;
 * stable within a bucket), moves entries with an active schedule window ahead
 * of the rest (stable, so bucket order holds within each side), and keeps the
 * first `MAX_LIST_ITEMS`. A worker-supplied `featured` flag is ignored.
 */
function createSelector(
  params: { countryCode?: string; regionCode?: string },
  headers: IncomingHttpHeaders,
  now: number,
) {
  const topics = parseTopics(headers['x-atproto-bsky-topics'])
  return (groups: l.Infer<typeof groupSchema>[] = []): SelectedGroup[] => {
    const buckets: l.Infer<typeof groupSchema>[][] = [[], [], [], []]
    for (const group of groups) {
      const bucket = selectionBucket(group, params, topics)
      if (bucket !== undefined) buckets[bucket].push(group)
    }
    const featured: SelectedGroup[] = []
    const ordinary: SelectedGroup[] = []
    for (const group of buckets.flat()) {
      const active = isFeatured(group, now)
      ;(active ? featured : ordinary).push({ ...group, featured: active })
    }
    return [...featured, ...ordinary].slice(0, MAX_LIST_ITEMS)
  }
}

/** Unlike banners, content needs both bounds to define a featured window. */
function isFeatured({ startsAt, endsAt }: Selectable, now: number): boolean {
  return (
    startsAt != null &&
    endsAt != null &&
    Date.parse(startsAt) <= now &&
    now < Date.parse(endsAt)
  )
}

function selectionBucket(
  { tags, locations }: Selectable,
  params: { countryCode?: string; regionCode?: string },
  topics: Set<string>,
): 0 | 1 | 2 | 3 | undefined {
  if (locations?.length) {
    if (!matchesLocation(locations, params)) return
    return 0
  }
  if (tags?.some((tag) => topics.has(tag))) return 1
  if (tags?.includes('general')) return 2
  if (!tags?.length) return 3
}

function parseTopics(header: string | string[] | undefined): Set<string> {
  const topics = new Set<string>()
  const value = Array.isArray(header) ? header.join(',') : header
  for (const token of value?.split(',') ?? []) {
    const topic = token.trim()
    if (topic) topics.add(topic)
  }
  return topics
}

/**
 * True only when a nonempty `locations` list matches the request. Entries are
 * a country (`JP`) or country and region (`US-WI`); a region alone never
 * matches. A full `regionCode` (`US-WI`) is honored only when its country
 * agrees with `countryCode`.
 */
function matchesLocation(
  locations: string[] | undefined,
  { countryCode, regionCode }: { countryCode?: string; regionCode?: string },
): boolean {
  const country = countryCode?.toUpperCase()
  if (!locations?.length || !country) return false
  let region = regionCode?.toUpperCase() || undefined
  if (region?.includes('-')) {
    const [regionCountry, subdivision] = region.split('-')
    region = regionCountry === country ? subdivision : undefined
  }
  return locations.some((location) => {
    const [locationCountry, locationRegion, ...rest] = location
      .toUpperCase()
      .split('-')
    if (rest.length || locationCountry !== country) return false
    return (
      locationRegion === undefined || (!!region && locationRegion === region)
    )
  })
}

function recordUri(value: unknown): AtUriString | undefined {
  if (!l.isAtUriString(value)) return
  const uri = new AtUri(value)
  return uri.collection && uri.rkey && l.isDidString(uri.hostname)
    ? value
    : undefined
}
