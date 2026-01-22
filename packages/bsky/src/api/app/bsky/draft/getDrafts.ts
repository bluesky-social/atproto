import { jsonStringToLex } from '@atproto/lexicon'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  DraftView,
  DraftWithId,
} from '../../../../lexicon/types/app/bsky/draft/defs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.draft.getDrafts({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.iss

      const { cursor, drafts } = await ctx.hydrator.dataplane.getActorDrafts({
        actorDid: viewer,
        limit: params.limit,
        cursor: params.cursor,
      })

      const draftViews = drafts.map((d): DraftView => {
        const draftWithId = jsonStringToLex(
          Buffer.from(d.payload).toString('utf8'),
        ) as DraftWithId
        return {
          id: draftWithId.id,
          draft: draftWithId.draft,
          // The date should always be present, but we avoid required fields on protobuf by convention,
          // so requires a fallback value to please TS.
          createdAt:
            d.createdAt?.toDate().toISOString() ?? new Date(0).toISOString(),
          updatedAt:
            d.updatedAt?.toDate().toISOString() ?? new Date(0).toISOString(),
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
