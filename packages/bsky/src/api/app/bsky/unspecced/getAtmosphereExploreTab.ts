import { chunkArray, mapDefined } from '@atproto/common'
import { type AtUriString, type NsidString, l } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import {
  MethodNotImplementedError,
  type Server,
  UpstreamFailureError,
  UpstreamTimeoutError,
} from '@atproto/xrpc-server'
import { safeFetchWrap } from '@atproto-labs/fetch-node'
import type { AppContext } from '../../../../context.js'
import type {
  ExternalRecordBacklinks,
  ExternalRecords,
} from '../../../../hydration/external.js'
import {
  type HydrateCtx,
  type HydrationState,
  type Hydrator,
  mergeManyStates,
} from '../../../../hydration/hydrator.js'
import { HydrationMap } from '../../../../hydration/util.js'
import { app, site, social } from '../../../../lexicons/index.js'
import { uriToDid } from '../../../../util/uris.js'

const MAX_CONFIG_BYTES = 512 * 1024
const MAX_ATMOSPHERE_RECORDS = 500
const MAX_GALLERY_ITEMS = 10
const MAX_PREVIEW_ACTORS = 3

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
      const state = await hydrateAtmosphere(uris, hydrateCtx, ctx.hydrator)
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

async function hydrateAtmosphere(
  uris: AtUriString[],
  ctx: HydrateCtx,
  hydrator: Hydrator,
): Promise<HydrationState> {
  const records = await hydrateRecords(uris, hydrator)
  const available = uris.filter((uri) => records.get(uri))
  const counts = await hydrator.external.getAtmosphereBacklinkCounts(available)
  const backlinks: ExternalRecordBacklinks = new HydrationMap()

  // @NOTE Bound fan-out as well as each backlink page; never scan a whole collection.
  for (const batch of chunkArray(available, 8)) {
    await Promise.all(
      batch.map(async (uri) => {
        const collection = new AtUri(uri).collection
        const sources: { collection: NsidString; limit: number }[] = []
        if (collection === site.standard.document.$type) {
          sources.push({
            collection: site.standard.graph.recommend.$type,
            limit: MAX_PREVIEW_ACTORS,
          })
        } else if (collection === site.standard.publication.$type) {
          sources.push({
            collection: site.standard.graph.subscription.$type,
            limit: MAX_PREVIEW_ACTORS,
          })
        } else if (collection === social.grain.gallery.$type) {
          sources.push(
            {
              collection: social.grain.favorite.$type,
              limit: MAX_PREVIEW_ACTORS,
            },
            {
              collection: social.grain.gallery.item.$type,
              limit: MAX_GALLERY_ITEMS,
            },
          )
        }
        const links: AtUriString[] = []
        for (const { collection, limit } of sources) {
          const page = await hydrator.external.getAtmosphereBacklinks(
            uri,
            collection,
            { limit },
          )
          links.push(
            ...mapDefined(page.backlinks.slice(0, limit), ({ uri: input }) => {
              const uri = recordUri(input)
              return uri && new AtUri(uri).collection === collection
                ? uri
                : undefined
            }),
          )
        }
        backlinks.set(uri, [...new Set(links)])
      }),
    )
  }
  records.merge(
    await hydrateRecords(
      [...backlinks.values()].flatMap((uris) => uris ?? []),
      hydrator,
    ),
  )

  const photoUris: AtUriString[] = []
  for (const [galleryUri, links] of backlinks) {
    if (new AtUri(galleryUri).collection !== social.grain.gallery.$type)
      continue
    for (const uri of links ?? []) {
      const item = social.grain.gallery.item.$ifMatches(
        records.get(uri)?.record,
      )
      if (
        !item ||
        item.gallery !== galleryUri ||
        uriToDid(uri) !== uriToDid(galleryUri)
      )
        continue
      const photoUri = recordUri(item.item)
      if (
        photoUri &&
        new AtUri(photoUri).collection === social.grain.photo.$type
      )
        photoUris.push(photoUri)
    }
  }
  records.merge(await hydrateRecords(photoUris, hydrator))

  const allUris = [...records.keys()]
  const dids = [...new Set(allUris.map(uriToDid))]
  const states: HydrationState[] = []
  for (const batch of chunkArray(dids, 200)) {
    states.push(await hydrator.hydrateProfilesBasic(batch, ctx))
  }
  for (const batch of chunkArray(allUris, MAX_ATMOSPHERE_RECORDS)) {
    states.push({
      labels: await hydrator.label.getLabelsForSubjects(batch, ctx.labelers),
    })
  }
  return {
    ...mergeManyStates(...states),
    ctx,
    externalRecords: records,
    externalRecordBacklinks: backlinks,
    externalRecordBacklinkCounts: counts,
  }
}

async function hydrateRecords(
  uris: AtUriString[],
  hydrator: Hydrator,
): Promise<ExternalRecords> {
  const records: ExternalRecords = new HydrationMap()
  for (const batch of chunkArray([...new Set(uris)], MAX_ATMOSPHERE_RECORDS)) {
    records.merge(await hydrator.external.getRecordsByURI(batch))
  }
  return records
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
