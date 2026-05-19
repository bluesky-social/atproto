import { LexMap } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { parseSiteStandardRecordKey } from '../../../../hydration/feed'
import { app, com } from '../../../../lexicons/index.js'
import { StrongRef } from '../../../../views/types.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.embed.getEmbedExternalView, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })

      const state = await ctx.hydrator.hydrateEmbedExternalViewFromUris(
        params.uris,
        hydrateCtx,
      )

      // Build associatedRefs from whatever survived hydration (taken-down
      // records were nulled out). Cardy embeds these into the post's
      // external.associatedRefs so the read path freezes to these exact
      // versions.
      const associatedRefs: StrongRef[] = []
      const associatedRecords: LexMap[] = []
      for (const [key, info] of state.siteStandardDocuments ?? []) {
        if (!info) continue
        const { uri } = parseSiteStandardRecordKey(key)
        associatedRefs.push(
          com.atproto.repo.strongRef.$build({ uri, cid: info.cid }),
        )
        associatedRecords.push(info.record as LexMap)
      }
      for (const [key, info] of state.siteStandardPublications ?? []) {
        if (!info) continue
        const { uri } = parseSiteStandardRecordKey(key)
        associatedRefs.push(
          com.atproto.repo.strongRef.$build({ uri, cid: info.cid }),
        )
        associatedRecords.push(info.record as LexMap)
      }

      if (!associatedRefs.length) {
        return { encoding: 'application/json', body: {} }
      }

      const overlay = ctx.views.externalEmbedFromStandardSite(
        associatedRefs,
        state,
      )
      // viewExternal requires uri/title/description. We fall back to the
      // request's `url` for `uri` and skip the view if the SS overlay
      // didn't supply title/description.
      const view =
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

      return {
        encoding: 'application/json',
        body: { view, associatedRefs, associatedRecords },
      }
    },
  })
}
