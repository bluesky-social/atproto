import { AtUriString, LexMap } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import {
  AssociatedSiteStandardRecord,
  SiteStandardDocument,
  SiteStandardDocuments,
  SiteStandardPublication,
  SiteStandardPublications,
} from '../../../../hydration/external.js'
import { HydrationMap } from '../../../../hydration/util.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { app, com } from '../../../../lexicons/index.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline.js'
import {
  collectAllowedPublicationUris,
  parseSiteStandardRecordKey,
} from '../../../../util/standard-site.js'
import { Views } from '../../../../views/index.js'
import { ExternalEmbedView, StrongRef } from '../../../../views/types.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getEmbedExternalView = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.add(app.bsky.embed.getEmbedExternalView, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const result = await getEmbedExternalView({ ...params, hydrateCtx }, ctx)
      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (
  inputs: SkeletonFnInput<Context, Params>,
): Promise<Skeleton> => {
  return { uris: inputs.params.uris as AtUriString[] }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateEmbedExternalViewFromUris(
    skeleton.uris,
    params.hydrateCtx,
  )
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
): Output => {
  const documents = inputs.hydration.siteStandardDocuments
  const publications = inputs.hydration.siteStandardPublications
  // Dispatch by record type. Today site.standard is the only kind we know
  // how to render; future record types get their own branch.
  if (
    (documents && documents.size > 0) ||
    (publications && publications.size > 0)
  ) {
    return standardSitePresentation(inputs, documents, publications)
  }
  return {}
}

const standardSitePresentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
  rawDocuments: SiteStandardDocuments | undefined,
  rawPublications: SiteStandardPublications | undefined,
): Output => {
  const { ctx, params, hydration } = inputs
  const documents =
    rawDocuments ?? new HydrationMap<string, SiteStandardDocument>()
  const publications =
    rawPublications ?? new HydrationMap<string, SiteStandardPublication>()

  // The dataplane auto-resolves each document's `site` field, so a
  // request for a document plus an unrelated publication URI will return
  // *both* publications. Compute an allow-set of publication URIs
  // referenced by hydrated docs and prune anything outside it. When
  // `allowedPublicationUris` is `undefined`, every publication is allowed
  // (publication-only resolution flow — no docs to constrain by). An
  // empty *set* still means "constraint exists, nothing matches" and
  // drops every publication (e.g. all hydrated docs are loose).
  const allowedPublicationUris =
    documents.size > 0 ? collectAllowedPublicationUris(documents) : undefined

  // Walk the hydration maps once: build the response's parallel
  // `associatedRefs` / `associatedRecords` arrays AND capture the first
  // hydrated doc / publication so we can hand them straight to the view
  // builder without a second by-ref lookup.
  const associatedRefs: StrongRef[] = []
  const associatedRecords: LexMap[] = []
  let firstDoc: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined
  let firstPub:
    | AssociatedSiteStandardRecord<SiteStandardPublication>
    | undefined

  for (const [key, info] of documents) {
    if (!info) continue
    const ref = parseSiteStandardRecordKey(key)
    associatedRefs.push(
      com.atproto.repo.strongRef.$build({ uri: ref.uri, cid: info.cid }),
    )
    associatedRecords.push(info.record as LexMap)
    if (!firstDoc) firstDoc = { ref, info }
  }
  for (const [key, info] of publications) {
    if (!info) continue
    const ref = parseSiteStandardRecordKey(key)
    if (allowedPublicationUris && !allowedPublicationUris.has(ref.uri)) continue
    associatedRefs.push(
      com.atproto.repo.strongRef.$build({ uri: ref.uri, cid: info.cid }),
    )
    associatedRecords.push(info.record as LexMap)
    if (!firstPub) firstPub = { ref, info }
  }

  // Additional guard in case all records in the maps have been takendown (and
  // so were set to null and aren't included in associatedRefs)
  if (!associatedRefs.length) return {}

  const overlay = ctx.views.externalEmbedFromStandardSiteRecords({
    document: firstDoc,
    publication: firstPub,
    state: hydration,
    assumedUrl: params.url,
  })

  // We always return a view when any record was hydrated. The lex marks
  // `title` and `description` as required, but SS records can produce a
  // partial view (e.g. a publication with no description), so we fill
  // missing fields with empty strings. Clients must treat an empty
  // `title` or `description` here as "no enrichment for this field"
  // rather than "the content is genuinely titleless." `uri` always falls
  // back to the request's `url`.
  const view = app.bsky.embed.external.view.$build({
    external: {
      ...overlay,
      uri: params.url,
      title: overlay?.title ?? '',
      description: overlay?.description ?? '',
      associatedRefs,
    },
  })

  return { view, associatedRefs, associatedRecords }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.embed.getEmbedExternalView.$Params & {
  hydrateCtx: HydrateCtx
}

type Skeleton = {
  uris: AtUriString[]
}

type Output = {
  view?: ExternalEmbedView
  associatedRefs?: StrongRef[]
  associatedRecords?: LexMap[]
}
