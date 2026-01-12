import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Draft } from '../../../../lexicon/types/app/bsky/draft/defs'
import { Namespaces } from '../../../../stash'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.draft.createDraft({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const actorDid = auth.credentials.iss
      const { draft } = input.body

      const res = await ctx.dataplane.countActorDrafts({
        actorDid: actorDid,
      })
      if (res.count >= ctx.cfg.draftsLimit) {
        throw new InvalidRequestError(
          `Drafts limit reached`,
          'DraftLimitReached',
        )
      }

      await ctx.stashClient.create({
        actorDid,
        namespace: Namespaces.AppBskyDraftDefsDraft,
        payload: draft satisfies Draft,
        key: draft.id,
      })
    },
  })
}
