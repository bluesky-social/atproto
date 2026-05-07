import { TID } from '@atproto/common'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { Namespaces } from '../../../../stash'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.draft.createDraft, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const actorDid = auth.credentials.iss
      const { draft } = input.body

      const res = await ctx.dataplane.getCountsForUsers({
        dids: [actorDid],
      })

      const draftsCount = res.drafts[0]
      if (draftsCount >= ctx.cfg.draftsLimit) {
        throw new InvalidRequestError(
          `Drafts limit reached`,
          'DraftLimitReached',
        )
      }

      const draftId = TID.nextStr()
      const draftWithId: app.bsky.draft.defs.DraftWithId = {
        id: draftId,
        draft,
      }

      await ctx.stashClient.create({
        actorDid,
        namespace: Namespaces.AppBskyDraftDefsDraftWithId,
        payload: draftWithId,
        key: draftId,
      })

      return {
        encoding: 'application/json' as const,
        body: { id: draftId },
      }
    },
  })
}
