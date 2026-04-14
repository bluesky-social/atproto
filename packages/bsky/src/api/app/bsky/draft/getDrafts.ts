import { DatetimeString, lexParse } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.draft.getDrafts, {
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.iss

      const { cursor, drafts } = await ctx.hydrator.dataplane.getActorDrafts({
        actorDid: viewer,
        limit: params.limit,
        cursor: params.cursor,
      })

      const draftViews = drafts.map((d): app.bsky.draft.defs.DraftView => {
        const jsonStr = Buffer.from(d.payload).toString('utf8')
        const draftWithId = lexParse<app.bsky.draft.defs.DraftWithId>(jsonStr)
        return {
          id: draftWithId.id,
          draft: draftWithId.draft,
          // The date should always be present, but we avoid required fields on protobuf by convention,
          // so requires a fallback value to please TS.
          createdAt: (
            d.createdAt?.toDate() ?? new Date(0)
          ).toISOString() as DatetimeString,
          updatedAt: (
            d.updatedAt?.toDate() ?? new Date(0)
          ).toISOString() as DatetimeString,
        }
      })

      return {
        encoding: 'application/json',
        body: {
          cursor,
          drafts: draftViews,
        },
      }
    },
  })
}
