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

const groupSchema = l.object({
  featured: l.boolean(),
  uris: l.array(l.unknown(), { maxLength: 100 }),
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
        const url = new URL(service)
        if (params.countryCode !== undefined) {
          url.searchParams.set('countryCode', params.countryCode)
        }
        if (params.regionCode !== undefined) {
          url.searchParams.set('regionCode', params.regionCode)
        }
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
      const articles = completeGroups(config.articles)
      const publications = completeGroups(config.publications)
      const photos = completeGroups(config.photos)
      const livestreams = completeGroups(config.livestreams)
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
        articles: mapDefined(articles, ({ featured, uri }) => {
          const view = ctx.views.externalRecordView(uri, state, now)
          return view && app.bsky.embed.external.viewArticle.$isTypeOf(view)
            ? { featured, view }
            : undefined
        }),
        publications: mapDefined(publications, ({ featured, uri }) => {
          const view = ctx.views.externalRecordView(uri, state, now)
          return view &&
            app.bsky.embed.external.viewArticlePublication.$isTypeOf(view)
            ? { featured, view }
            : undefined
        }),
        photos: mapDefined(photos, ({ featured, uri }) => {
          const view = ctx.views.externalRecordView(uri, state, now)
          return view &&
            app.bsky.embed.external.viewGallery.$isTypeOf(view) &&
            view.items.length
            ? { featured, view }
            : undefined
        }),
        livestreams: mapDefined(livestreams, ({ featured, uri }) => {
          const view = ctx.views.externalRecordView(uri, state, now)
          return view && app.bsky.embed.external.viewLivestream.$isTypeOf(view)
            ? { featured, view }
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
  return mapDefined(groups, ({ featured, uris }) => {
    const uri = recordUri(uris[0])
    if (!uri) return
    return { featured, uri }
  })
}

function recordUri(value: unknown): AtUriString | undefined {
  if (!l.isAtUriString(value)) return
  const uri = new AtUri(value)
  return uri.collection && uri.rkey && l.isDidString(uri.hostname)
    ? value
    : undefined
}
