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
import type { HydrationState } from '../../../../hydration/hydrator.js'
import { app, site, social } from '../../../../lexicons/index.js'

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
type RecordGroup = { featured: boolean; uris: AtUriString[] }

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
      const photos = completeGroups(
        config.photos?.map((group) => ({
          ...group,
          // @NOTE Gallery membership comes from backlinks, not loose CMS photo URIs.
          uris: mapDefined(group.uris, (input) => {
            const uri = recordUri(input)
            return uri &&
              new AtUri(uri).collection === social.grain.gallery.$type
              ? uri
              : undefined
          }),
        })),
      )
      const livestreams = completeGroups(config.livestreams)
      const uris = [
        ...new Set(
          [...articles, ...publications, ...photos, ...livestreams].flatMap(
            ({ uris }) => uris,
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
        articles: mapDefined(articles, ({ featured, uris }) => {
          const uri = articleUri(uris, state)
          const view = uri
            ? ctx.views.externalRecordView(uri, state, now)
            : undefined
          return view && app.bsky.embed.external.viewArticle.$isTypeOf(view)
            ? { featured, view }
            : undefined
        }),
        publications: mapDefined(publications, ({ featured, uris }) => {
          const view =
            uris.length === 1
              ? ctx.views.externalRecordView(uris[0], state, now)
              : undefined
          return view &&
            app.bsky.embed.external.viewArticlePublication.$isTypeOf(view)
            ? { featured, view }
            : undefined
        }),
        photos: mapDefined(photos, ({ featured, uris }) => {
          const view =
            uris.length === 1
              ? ctx.views.externalRecordView(uris[0], state, now)
              : undefined
          return view &&
            app.bsky.embed.external.viewGallery.$isTypeOf(view) &&
            view.items.length
            ? { featured, view }
            : undefined
        }),
        livestreams: mapDefined(livestreams, ({ featured, uris }) => {
          const view =
            uris.length === 1
              ? ctx.views.externalRecordView(uris[0], state, now)
              : undefined
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
    const valid = mapDefined(uris, recordUri)
    if (!valid.length || valid.length !== uris.length) return
    return { featured, uris: valid }
  })
}

// @NOTE A publication hydrated for another CMS group must not complete this article.
function articleUri(
  uris: AtUriString[],
  state: HydrationState,
): AtUriString | undefined {
  const documents = uris.filter(
    (uri) => new AtUri(uri).collection === site.standard.document.$type,
  )
  const publications = uris.filter(
    (uri) => new AtUri(uri).collection === site.standard.publication.$type,
  )
  if (
    documents.length !== 1 ||
    publications.length > 1 ||
    documents.length + publications.length !== uris.length
  )
    return
  const uri = documents[0]
  const document = site.standard.document.$ifMatches(
    state.externalRecords?.get(uri)?.record,
  )
  if (!document) return
  if (document.site.startsWith('at://')) {
    if (document.site !== publications[0]) return
  } else if (publications.length) return
  return uri
}

function recordUri(value: unknown): AtUriString | undefined {
  if (!l.isAtUriString(value)) return
  const uri = new AtUri(value)
  return uri.collection && uri.rkey && l.isDidString(uri.hostname)
    ? value
    : undefined
}
