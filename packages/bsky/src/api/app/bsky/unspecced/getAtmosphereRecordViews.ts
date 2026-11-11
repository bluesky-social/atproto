import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import {
  type ExternalRecords,
  genericRecordKey,
} from '../../../../hydration/external.js'
import type { HydrationState } from '../../../../hydration/hydrator.js'
import { HydrationMap, type ItemRef } from '../../../../hydration/util.js'
import { app, site, social } from '../../../../lexicons/index.js'
import { collectAssociations } from '../../../../util/external/associations.js'
import {
  isCompleteRecordUri,
  recordUriOf,
  uriToDid,
} from '../../../../util/uris.js'
import { isRecordAvailable } from '../../../../views/external.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.unspecced.getAtmosphereRecordViews, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth, req }) => {
      const refs = input.body.records
      for (const { uri } of refs) {
        if (!isCompleteRecordUri(uri)) {
          throw new InvalidRequestError(
            'records must contain complete DID-based record URIs',
          )
        }
      }
      const { viewer, includeTakedowns, include3pBlocks, skipViewerBlocks } =
        ctx.authVerifier.parseCreds(auth)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers: ctx.reqLabelers(req),
        viewer,
        includeTakedowns,
        include3pBlocks,
        skipViewerBlocks,
        xrpcEndpoint: app.bsky.unspecced.getAtmosphereRecordViews.$lxm,
      })
      const state = await ctx.hydrator.hydrateEmbedExternalViewFromRefs(
        refs,
        hydrateCtx,
        { hydration: 'basic' },
      )
      return {
        encoding: 'application/json',
        body: { views: refs.map((ref) => recordView(ref, state, ctx)) },
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

function recordView(
  { uri, cid }: ItemRef,
  state: HydrationState,
  ctx: AppContext,
): app.bsky.unspecced.getAtmosphereRecordViews.RecordView {
  const root =
    cid === undefined
      ? state.externalRecords?.get(uri)
      : state.externalRecordsByRef?.get(genericRecordKey({ uri, cid }))
  if (!isRecordAvailable(root, uri, state, ctx.views)) return {}

  // @NOTE Batch state contains unrelated roots and dependencies. Associations
  // must follow only this selected version's content links, never every record
  // of an eligible collection in the shared state.
  const dependencies: ExternalRecords = new HydrationMap()
  const add = (recordUri: ItemRef['uri']) => {
    const info = state.externalRecords?.get(recordUri)
    if (isRecordAvailable(info, recordUri, state, ctx.views)) {
      dependencies.set(recordUri, info)
    }
  }
  if (site.standard.document.$matches(root.record, { strict: false })) {
    const publication = recordUriOf(
      root.record.site,
      site.standard.publication.$type,
    )
    if (publication) add(publication)
  } else if (social.grain.gallery.$matches(root.record, { strict: false })) {
    for (const itemUri of state.externalRecordBacklinks?.get(uri) ?? []) {
      const item = state.externalRecords?.get(itemUri)
      if (
        !isRecordAvailable(item, itemUri, state, ctx.views) ||
        !social.grain.gallery.item.$matches(item.record, { strict: false }) ||
        item.record.gallery !== uri ||
        uriToDid(itemUri) !== uriToDid(uri)
      ) {
        continue
      }
      dependencies.set(itemUri, item)
      const photo = recordUriOf(item.record.item, social.grain.photo.$type)
      if (photo) add(photo)
    }
  }
  return {
    view: ctx.views.externalRecordView(uri, state, undefined, cid),
    ...collectAssociations(uri, dependencies, root),
  }
}
