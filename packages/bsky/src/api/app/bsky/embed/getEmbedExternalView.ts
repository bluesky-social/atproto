import type { AtUriString, LexMap } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import {
  type SiteStandardDocuments,
  type SiteStandardPublications,
  getSiteStandardRecordsFromHydrationMapsByDocumentUri,
} from '../../../../hydration/external.js'
import type { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { app, com } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline.js'
import type { Views } from '../../../../views/index.js'
import type { ExternalEmbedView, StrongRef } from '../../../../views/types.js'
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
  const { hydration } = inputs
  const documents = hydration.siteStandardDocuments
  const publications = hydration.siteStandardPublications
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
  documents: SiteStandardDocuments | undefined,
  publications: SiteStandardPublications | undefined,
): Output => {
  const { ctx, params, hydration } = inputs

  // Pick the first hydrated doc, then pair it with the publication its
  // `site` field points at (if any). Docs the dataplane auto-resolved a
  // publication for end up matched; unrelated publications fall away.
  const { document, publication } =
    getSiteStandardRecordsFromHydrationMapsByDocumentUri(
      documents,
      publications,
    )

  // Emit response refs/records only for the records we actually selected.
  // Anything else (e.g. extra publications the dataplane returned) is
  // intentionally excluded so the strongRefs Cardy writes onto the post
  // match the view we built. Profiles are emitted in the same order as
  // refs (one per slot) so consumers can match by index.
  const associatedRefs: StrongRef[] = []
  const associatedRecords: LexMap[] = []
  for (const slot of [document, publication]) {
    if (!slot) continue
    associatedRefs.push(
      com.atproto.repo.strongRef.$build({
        uri: slot.ref.uri,
        cid: slot.info.cid,
      }),
    )
    associatedRecords.push(slot.info.record as LexMap)
  }

  if (!associatedRefs.length) return {}

  const overlay = ctx.views.externalEmbedFromStandardSiteRecords({
    document,
    publication,
    state: hydration,
    assumedUrl: params.url,
  })
  // The view builder rejected the records (validation failed, or the pair
  // didn't produce the title viewExternal requires). Return nothing — Cardy
  // falls back to its own card render and doesn't write strongRefs to the
  // post.
  if (!overlay) return {}

  const view = app.bsky.embed.external.view.$build({
    external: {
      ...overlay,
      uri: params.url,
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
