import type { AtUriString } from '@atproto/lex-schema'
import { isDidString } from '@atproto/lex-schema'
import { parseAtUriString } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import {
  type ExternalRecords,
  genericRecordKey,
} from '../../../../hydration/external.js'
import { HydrationMap } from '../../../../hydration/util.js'
import { app } from '../../../../lexicons/index.js'
import { collectAssociations } from '../../../../util/external/associations.js'
import { availableRecord } from '../../../../views/external.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.unspecced.getAtmosphereRecordView, {
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const { uri, cid } = params
      if (!isCompleteRecordUri(uri)) {
        throw new InvalidRequestError(
          'uri must be a complete DID-based record URI',
        )
      }
      const { viewer, includeTakedowns, include3pBlocks, skipViewerBlocks } =
        ctx.authVerifier.parseCreds(auth)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers: ctx.reqLabelers(req),
        viewer,
        includeTakedowns,
        include3pBlocks,
        skipViewerBlocks,
        xrpcEndpoint: app.bsky.unspecced.getAtmosphereRecordView.$lxm,
      })

      const options = { hydration: 'basic' } as const
      const state =
        cid === undefined
          ? await ctx.hydrator.hydrateEmbedExternalViewFromUris(
              [uri],
              hydrateCtx,
              options,
            )
          : await ctx.hydrator.hydrateEmbedExternalViewFromRefs(
              [{ uri, cid }],
              hydrateCtx,
              options,
            )

      // Request-local URI-keyed records: latest dependencies, with the root
      // replaced by the exact pinned version (or absent) when a CID is given.
      const candidates = new HydrationMap(state.externalRecords ?? [])
      if (cid !== undefined) {
        candidates.set(
          uri,
          state.externalRecordsByRef?.get(genericRecordKey({ uri, cid })) ??
            null,
        )
      }
      const visible: ExternalRecords = new HydrationMap()
      for (const [recordUri, info] of candidates) {
        visible.set(
          recordUri,
          availableRecord(ctx.views, recordUri, state, info) ?? null,
        )
      }

      let body: app.bsky.unspecced.getAtmosphereRecordView.$OutputBody = {}
      if (visible.get(uri)) {
        const viewState = { ...state, externalRecords: visible }
        body = {
          view: ctx.views.externalRecordView(uri, viewState),
          ...collectAssociations(uri, visible),
        }
      }
      return {
        encoding: 'application/json',
        body,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

/** A complete DID-based record URI: collection and rkey, no query/fragment. */
const isCompleteRecordUri = (value: string): value is AtUriString => {
  const parsed = parseAtUriString(value)
  return (
    parsed.success &&
    isDidString(parsed.value.authority) &&
    !!parsed.value.collection &&
    !!parsed.value.rkey &&
    parsed.value.query === undefined &&
    parsed.value.hash === undefined
  )
}
