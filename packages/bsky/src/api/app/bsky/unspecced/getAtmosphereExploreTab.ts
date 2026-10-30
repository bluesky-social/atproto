import type { IncomingHttpHeaders } from 'node:http'
import { mapDefined, noUndefinedVals } from '@atproto/common'
import { type AtUriString, type Client, type DidString, l } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import {
  ForbiddenError,
  MethodNotImplementedError,
  type Server,
  UpstreamFailureError,
  UpstreamTimeoutError,
} from '@atproto/xrpc-server'
import { safeFetchWrap } from '@atproto-labs/fetch-node'
import type { AppContext } from '../../../../context.js'
import {
  type HydrateCtx,
  type Hydrator,
  mergeStates,
} from '../../../../hydration/hydrator.js'
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

const groupFields = {
  canonicalUri: l.optional(l.unknown()),
  tags: l.optional(l.array(l.string({ maxLength: 128 }), { maxLength: 100 })),
  locations: l.optional(
    l.array(l.string({ maxLength: 16 }), { maxLength: 100 }),
  ),
}
const groupSchema = l.object(groupFields)
// Only livestreams are scheduled; other groups ignore any schedule fields.
const optionalDatetime = l.optional(
  l.nullable(l.string({ format: 'datetime' })),
)
const livestreamSchema = l.object({
  ...groupFields,
  previewAt: optionalDatetime,
  startsAt: optionalDatetime,
  endsAt: optionalDatetime,
})
// `did` hydrates the app's profile; `null` and absent both mean no profile.
const appDidSchema = l.optional(l.nullable(l.string({ format: 'did' })))
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
        // Location filtering happens locally, so fetch the full config as-is.
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
  const select = createSelector(params, params.requestHeaders)
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
                ? { uri: root }
                : undefined
            },
          )
        : completeGroups(select(config.articles)),
    ),
    articleRecIdStr: recommendations?.recIdStr,
    publications: orderGroups(completeGroups(select(config.publications))),
    photos: orderGroups(completeGroups(select(config.photos))),
    // Expired and not-yet-previewed livestreams are dropped before selection,
    // so they never consume the cap.
    livestreams: orderGroups(
      mapDefined(
        select(config.livestreams.filter((entry) => isPreviewable(entry, now))),
        ({ canonicalUri, startsAt }) => {
          const uri = recordUri(canonicalUri)
          return uri ? { uri, startsAt } : undefined
        },
      ),
    ),
    // Apps are not record-backed: keep worker order.
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
  const dids = [...new Set(mapDefined(skeleton.apps, ({ did }) => did))]
  const [externalState, appProfileState] = await Promise.all([
    ctx.hydrator.hydrateEmbedExternalViewFromUris(uris, params.hydrateCtx),
    dids.length
      ? ctx.hydrator.hydrateProfilesDetailed(dids, params.hydrateCtx)
      : {},
  ])
  // Detailed profile state goes second so it wins any overlapping actor state.
  return mergeStates(externalState, appProfileState)
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
  const { now, articles, publications, photos, livestreams, apps } = skeleton
  return {
    announcementBanner: skeleton.announcementBanner,
    articles: {
      items: mapDefined(articles, ({ uri }) => {
        const view = ctx.views.externalRecordView(uri, state, now)
        return view && app.bsky.embed.external.viewArticle.$isTypeOf(view)
          ? { view }
          : undefined
      }),
      recIdStr: skeleton.articleRecIdStr,
    },
    publications: {
      items: mapDefined(publications, ({ uri }) => {
        const view = ctx.views.externalRecordView(uri, state, now)
        return view &&
          app.bsky.embed.external.viewArticlePublication.$isTypeOf(view)
          ? { view }
          : undefined
      }),
    },
    photos: {
      items: mapDefined(photos, ({ uri }) => {
        const view = ctx.views.externalRecordView(uri, state, now)
        return view &&
          app.bsky.embed.external.viewGallery.$isTypeOf(view) &&
          view.items.length
          ? { view }
          : undefined
      }),
    },
    livestreams: {
      items: mapDefined(livestreams, ({ uri, startsAt }) => {
        const view = ctx.views.externalRecordView(uri, state, now)
        if (!view || !app.bsky.embed.external.viewLivestream.$isTypeOf(view))
          return
        // Previewed streams are never live; copy rather than mutate the view.
        return startsAt != null && Date.parse(startsAt) > now
          ? { view: { ...view, active: false } }
          : { view }
      }),
    },
    apps: apps.map(({ card, did }) => {
      const profile = did ? ctx.views.profileDetailed(did, state) : undefined
      return {
        id: card.id,
        title: card.title,
        description: card.description,
        logo: profile?.avatar ?? card.logo,
        backgroundImage: profile?.banner ?? card.backgroundImage,
        overlayColor: card.overlayColor,
        textColor: card.textColor,
        url: card.url,
        category: card.category,
        profile,
      }
    }),
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
type LivestreamGroup = l.Infer<typeof livestreamSchema>
type AppCard = app.bsky.unspecced.getAtmosphereExploreTab.AppCard
// A validated public card plus the internal DID used to hydrate its profile.
type AppEntry = { card: AppCard; did?: DidString }
type ValidBanner = {
  banner: l.Infer<typeof bannerSchema>
  presentation: AnnouncementBanner
}
type ExploreConfig = {
  announcementBanners: ValidBanner[]
  articles: Group[]
  publications: Group[]
  photos: Group[]
  livestreams: LivestreamGroup[]
  apps: AppEntry[]
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
    livestreams: valid(livestreamSchema, config.livestreams),
    apps: entries(config.apps).flatMap((entry) => {
      const parsed = parseApp(entry)
      return parsed ? [parsed] : []
    }),
  }
}

const APP_CARD_FIELDS = [
  'id',
  'title',
  'description',
  'logo',
  'backgroundImage',
  'overlayColor',
  'textColor',
  'url',
  'category',
] as const

/**
 * Validates an app entry. Only the public card fields are copied (so a
 * supplied `profile` or `profileUrl` is never read) and only `did` is kept
 * beyond them. A present but malformed `did` drops the app.
 */
function parseApp(entry: unknown): AppEntry | undefined {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry))
    return
  const raw = entry as Record<string, unknown>
  const did = appDidSchema.safeParse(raw.did)
  if (!did.success) return
  const card = app.bsky.unspecced.getAtmosphereExploreTab.appCard.safeParse(
    noUndefinedVals(
      Object.fromEntries(APP_CARD_FIELDS.map((key) => [key, raw[key]])),
    ),
  )
  if (!card.success) return
  return { card: card.value, did: did.value ?? undefined }
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

type RecordGroup = { uri: AtUriString }
type LivestreamRecordGroup = RecordGroup & { startsAt?: string | null }

type SkeletonState = {
  now: number
  announcementBanner?: app.bsky.unspecced.getAtmosphereExploreTab.AnnouncementBanner
  articles: RecordGroup[]
  articleRecIdStr?: string
  publications: RecordGroup[]
  photos: RecordGroup[]
  livestreams: LivestreamRecordGroup[]
  apps: AppEntry[]
}

/**
 * Randomizes a selected list (Fisher-Yates) and caps it. Runs before hydration,
 * so presentation keeps this order.
 */
function orderGroups<T extends RecordGroup>(groups: T[]): T[] {
  const shuffled = [...groups]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, MAX_LIST_ITEMS)
}

function completeGroups(groups: Group[] = []): RecordGroup[] {
  return mapDefined(groups, ({ canonicalUri }) => {
    const uri = recordUri(canonicalUri)
    return uri ? { uri } : undefined
  })
}

/**
 * Editorial window for a livestream: shown from `previewAt` (falling back to
 * `startsAt`) inclusive until `endsAt` exclusive. Absent or null bounds are
 * open. This is independent of the view's heartbeat-based `active` flag.
 */
function isPreviewable(
  { previewAt, startsAt, endsAt }: LivestreamGroup,
  now: number,
): boolean {
  const start = previewAt ?? startsAt
  if (start != null && Date.parse(start) > now) return false
  return endsAt == null || now < Date.parse(endsAt)
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
}

/**
 * Builds a per-list selector that drops location-ineligible entries, orders
 * the rest by priority bucket (location, requested topic, `general`, untagged;
 * stable within a bucket), and keeps the first `MAX_LIST_ITEMS`.
 */
function createSelector(
  params: { countryCode?: string; regionCode?: string },
  headers: IncomingHttpHeaders,
) {
  const topics = parseTopics(headers['x-atproto-bsky-topics'])
  return <T extends Group>(groups: T[] = []): T[] => {
    const buckets: T[][] = [[], [], [], []]
    for (const group of groups) {
      const bucket = selectionBucket(group, params, topics)
      if (bucket !== undefined) buckets[bucket].push(group)
    }
    return buckets.flat().slice(0, MAX_LIST_ITEMS)
  }
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
