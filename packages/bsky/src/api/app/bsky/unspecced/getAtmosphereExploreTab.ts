import type { IncomingHttpHeaders } from 'node:http'
import { mapDefined } from '@atproto/common'
import { type AtUriString, l } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import {
  MethodNotImplementedError,
  type Server,
  UpstreamFailureError,
  UpstreamTimeoutError,
} from '@atproto/xrpc-server'
import { safeFetchWrap } from '@atproto-labs/fetch-node'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'

const MAX_CONFIG_BYTES = 512 * 1024
const MAX_SELECTED_GROUPS = 10

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
const configSchema = l.object({
  announcementBanners: l.optional(l.array(bannerSchema, { maxLength: 100 })),
  articles: l.optional(l.array(groupSchema, { maxLength: 100 })),
  publications: l.optional(l.array(groupSchema, { maxLength: 100 })),
  photos: l.optional(l.array(groupSchema, { maxLength: 100 })),
  livestreams: l.optional(l.array(groupSchema, { maxLength: 100 })),
  apps: l.optional(
    l.array(app.bsky.unspecced.getAtmosphereExploreTab.appCard, {
      maxLength: 100,
    }),
  ),
})
type RecordGroup = { featured: boolean; uri: AtUriString }

export default function (server: Server, ctx: AppContext) {
  // @NOTE The wrapper caps decoded response bytes, including compressed bodies.
  const fetchConfig = safeFetchWrap({
    timeout: 5000,
    responseMaxSize: MAX_CONFIG_BYTES,
  })
  server.add(app.bsky.unspecced.getAtmosphereExploreTab, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req, signal }) => {
      const service = ctx.cfg.atmosphereExploreTabService
      if (!service)
        throw new MethodNotImplementedError(
          'Atmosphere Explore service not configured',
        )
      let body: unknown
      try {
        // Location filtering happens locally, so fetch the full config as-is.
        const url = new URL(service)
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
        body = await response.json()
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
      const parsed = configSchema.safeParse(body)
      if (!parsed.success)
        throw new UpstreamFailureError(
          'Invalid Atmosphere Explore configuration',
        )
      const config = parsed.value
      const now = Date.now()
      const announcementBanner = selectBanner(
        config.announcementBanners,
        params,
        now,
      )
      const select = createSelector(params, req.headers, now)
      const articles = completeGroups(select(config.articles))
      const publications = completeGroups(select(config.publications))
      const photos = completeGroups(select(config.photos))
      const livestreams = completeGroups(select(config.livestreams))
      const uris = [
        ...new Set(
          [...articles, ...publications, ...photos, ...livestreams].map(
            ({ uri }) => uri,
          ),
        ),
      ]
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer: auth.credentials.iss,
        labelers: ctx.reqLabelers(req),
      })
      const state = await ctx.hydrator.hydrateEmbedExternalViewFromUris(
        uris,
        hydrateCtx,
      )
      const result: app.bsky.unspecced.getAtmosphereExploreTab.$OutputBody = {
        announcementBanner,
        articles: {
          items: mapDefined(articles, ({ featured, uri }) => {
            const view = ctx.views.externalRecordView(uri, state, now)
            return view && app.bsky.embed.external.viewArticle.$isTypeOf(view)
              ? { featured, view }
              : undefined
          }),
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
            return view &&
              app.bsky.embed.external.viewLivestream.$isTypeOf(view)
              ? { featured, view }
              : undefined
          }),
        },
        apps: config.apps ?? [],
      }
      return { encoding: 'application/json', body: result }
    },
  })
}

function completeGroups(groups: SelectedGroup[] = []): RecordGroup[] {
  return mapDefined(groups, ({ featured, canonicalUri }) => {
    const uri = recordUri(canonicalUri)
    if (!uri) return
    return { featured, uri }
  })
}

type Banner = l.Infer<typeof bannerSchema>
type AnnouncementBanner =
  app.bsky.unspecced.getAtmosphereExploreTab.AnnouncementBanner

/**
 * Validates every banner's presentation, then returns the single banner to
 * show. Eligible (enabled, in window) banners targeted at a matching location
 * win, first in worker order; otherwise the unrestricted eligible banner with
 * the furthest-out `endsAt` (absent means no expiration; ties keep worker order).
 */
function selectBanner(
  banners: Banner[] = [],
  params: { countryCode?: string; regionCode?: string },
  now: number,
): AnnouncementBanner | undefined {
  const validated = banners.map((banner) => {
    const presentation =
      app.bsky.unspecced.getAtmosphereExploreTab.announcementBanner.$safeValidate(
        banner,
      )
    if (!presentation.success)
      throw new UpstreamFailureError('Invalid Atmosphere Explore configuration')
    return { banner, presentation: presentation.value }
  })
  let matched: AnnouncementBanner | undefined
  let fallback: AnnouncementBanner | undefined
  let fallbackEnd = -Infinity
  for (const { banner, presentation } of validated) {
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
 * first `MAX_SELECTED_GROUPS`. A worker-supplied `featured` flag is ignored.
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
    return [...featured, ...ordinary].slice(0, MAX_SELECTED_GROUPS)
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
