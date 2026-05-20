import { AtUriString, LexMap } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
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
  const { ctx, params, hydration } = inputs

  const documents = hydration.siteStandardDocuments ?? new Map()
  const publications = hydration.siteStandardPublications ?? new Map()
  // Nothing hydrated -> no view, no refs to write. Cardy falls back to its
  // own link-card rendering.
  if (documents.size === 0 && publications.size === 0) return {}

  // The dataplane auto-resolves each document's `site` field, so a request
  // for a document plus an unrelated publication URI will return *both*
  // publications. Drop any publication not referenced by a hydrated
  // document's `site`. Empty when no documents were hydrated, in which
  // case we skip the prune below (publication-only resolution flow).
  const allowedPublicationUris = collectAllowedPublicationUris(documents)

  // Walk the hydration maps once to build the response's parallel
  // `associatedRefs` / `associatedRecords` arrays. We then hand
  // `associatedRefs` back to `externalEmbedFromStandardSite`, which walks the
  // same maps a second time to build the view; both passes are bounded by
  // the lex's `uris.maxLength`.
  const associatedRefs: StrongRef[] = []
  const associatedRecords: LexMap[] = []
  for (const [key, info] of documents) {
    if (!info) continue
    const { uri } = parseSiteStandardRecordKey(key)
    associatedRefs.push(
      com.atproto.repo.strongRef.$build({ uri, cid: info.cid }),
    )
    associatedRecords.push(info.record as LexMap)
  }
  // Only apply the allow-set when we hydrated at least one document; with
  // no documents in play we keep every publication (publication-only flow).
  const prunePublications = documents.size > 0
  for (const [key, info] of publications) {
    if (!info) continue
    const { uri } = parseSiteStandardRecordKey(key)
    if (prunePublications && !allowedPublicationUris.has(uri)) continue
    associatedRefs.push(
      com.atproto.repo.strongRef.$build({ uri, cid: info.cid }),
    )
    associatedRecords.push(info.record as LexMap)
  }

  // Additional guard in case all records in the maps have been takendown (and
  // so were set to null and aren't included in associatedRefs)
  if (!associatedRefs.length) return {}

  // this must happen after we've pruned any publications not associated with a
  // hydrated document, since the view builder will walk the associatedRefs to
  // find the records it needs to build the view
  const overlay = ctx.views.externalEmbedFromStandardSite(
    associatedRefs,
    hydration,
  )
  // viewExternal requires uri/title/description, but we fall back to the
  // request's `url` for `uri` and return the view even if we default to empty
  // strings. We did our best.
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
