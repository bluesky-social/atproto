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
const MAX_ATMOSPHERE_RECORDS = 500
const MAX_SELECTED_GROUPS = 10

const groupSchema = l.object({
  uris: l.array(l.unknown(), { maxLength: 100 }),
  tags: l.optional(l.array(l.string({ maxLength: 128 }), { maxLength: 100 })),
  locations: l.optional(
    l.array(l.string({ maxLength: 16 }), { maxLength: 100 }),
  ),
})
const configSchema = l.object({
  announcementBanner: l.optional(
    app.bsky.unspecced.getAtmosphereExploreTab.announcementBanner,
  ),
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
type RecordGroup = { uri: AtUriString }

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
      const groups = [
        ...(config.articles ?? []),
        ...(config.publications ?? []),
        ...(config.photos ?? []),
        ...(config.livestreams ?? []),
      ]
      if (
        groups.reduce((count, group) => count + group.uris.length, 0) >
        MAX_ATMOSPHERE_RECORDS
      ) {
        throw new UpstreamFailureError(
          'Atmosphere Explore configuration exceeds its record limit',
        )
      }
      const select = createSelector(params, req.headers)
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
      const now = Date.now()
      const result: app.bsky.unspecced.getAtmosphereExploreTab.$OutputBody = {
        announcementBanner: config.announcementBanner,
        articles: mapDefined(articles, ({ uri }) => {
          const view = ctx.views.externalRecordView(uri, state, now)
          return view && app.bsky.embed.external.viewArticle.$isTypeOf(view)
            ? { featured: false, view }
            : undefined
        }),
        publications: mapDefined(publications, ({ uri }) => {
          const view = ctx.views.externalRecordView(uri, state, now)
          return view &&
            app.bsky.embed.external.viewArticlePublication.$isTypeOf(view)
            ? { featured: false, view }
            : undefined
        }),
        photos: mapDefined(photos, ({ uri }) => {
          const view = ctx.views.externalRecordView(uri, state, now)
          return view &&
            app.bsky.embed.external.viewGallery.$isTypeOf(view) &&
            view.items.length
            ? { featured: false, view }
            : undefined
        }),
        livestreams: mapDefined(livestreams, ({ uri }) => {
          const view = ctx.views.externalRecordView(uri, state, now)
          return view && app.bsky.embed.external.viewLivestream.$isTypeOf(view)
            ? { featured: false, view }
            : undefined
        }),
        apps: config.apps ?? [],
      }
      return { encoding: 'application/json', body: result }
    },
  })
}

function completeGroups(
  groups: l.Infer<typeof groupSchema>[] = [],
): RecordGroup[] {
  return mapDefined(groups, ({ uris }) => {
    const uri = recordUri(uris[0])
    if (!uri) return
    return { uri }
  })
}

type Selectable = { tags?: string[]; locations?: string[] }

/**
 * Builds a per-list selector that drops location-ineligible entries, orders
 * the rest by priority bucket (location, requested topic, `general`, untagged;
 * stable within a bucket), and keeps the first `MAX_SELECTED_GROUPS`.
 */
function createSelector(
  params: { countryCode?: string; regionCode?: string },
  headers: IncomingHttpHeaders,
) {
  const topics = parseTopics(headers['x-atproto-bsky-topics'])
  return <T extends Selectable>(groups: T[] = []): T[] => {
    const buckets: T[][] = [[], [], [], []]
    for (const group of groups) {
      const bucket = selectionBucket(group, params, topics)
      if (bucket !== undefined) buckets[bucket].push(group)
    }
    return buckets.flat().slice(0, MAX_SELECTED_GROUPS)
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
