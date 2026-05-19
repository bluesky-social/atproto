import { AtUriString, LexMap } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { parseSiteStandardRecordKey } from '../../../../hydration/external.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { app, com } from '../../../../lexicons/index.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline.js'
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

  // Walk the hydration maps once to build the response's parallel
  // `associatedRefs` / `associatedRecords` arrays. We then hand
  // `associatedRefs` back to `externalEmbedFromStandardSite`, which walks the
  // same maps a second time to build the view; both passes are bounded by
  // the lex's `uris.maxLength`.
  const associatedRefs: StrongRef[] = []
  const associatedRecords: LexMap[] = []
  for (const [key, info] of hydration.siteStandardDocuments ?? []) {
    if (!info) continue
    const { uri } = parseSiteStandardRecordKey(key)
    associatedRefs.push(
      com.atproto.repo.strongRef.$build({ uri, cid: info.cid }),
    )
    associatedRecords.push(info.record as LexMap)
  }
  for (const [key, info] of hydration.siteStandardPublications ?? []) {
    if (!info) continue
    const { uri } = parseSiteStandardRecordKey(key)
    associatedRefs.push(
      com.atproto.repo.strongRef.$build({ uri, cid: info.cid }),
    )
    associatedRecords.push(info.record as LexMap)
  }

  if (!associatedRefs.length) return {}

  const overlay = ctx.views.externalEmbedFromStandardSite(
    associatedRefs,
    hydration,
  )
  // viewExternal requires uri/title/description. We fall back to the
  // request's `url` for `uri` and skip the view if the SS overlay didn't
  // supply title/description.
  const view: ExternalEmbedView | undefined =
    overlay?.title && overlay?.description
      ? app.bsky.embed.external.view.$build({
          external: {
            ...overlay,
            uri: params.url,
            title: overlay.title,
            description: overlay.description,
            associatedRefs,
          },
        })
      : undefined

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
