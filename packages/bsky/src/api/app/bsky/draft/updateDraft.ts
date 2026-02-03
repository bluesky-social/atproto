import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { DraftWithId } from '../../../../lexicon/types/app/bsky/draft/defs'
import { Namespaces } from '../../../../stash'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.draft.updateDraft({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const actorDid = auth.credentials.iss
      const { draft: draftWithId } = input.body

      // NOTE: update drafts does not enforce limits, because if it did, we would not allow updating when the limit is reached,
      // which is not the desired behavior.
      // But this means the consumer of the stash operations can't do an upsert behavior on update, and needs instead to drop non-existent
      // drafts. This avoid misusing the update as a create that does not check limits.

      await ctx.stashClient.update({
        actorDid,
        namespace: Namespaces.AppBskyDraftDefsDraftWithId,
        payload: draftWithId satisfies DraftWithId,
        key: draftWithId.id,
      })
    },
  })
}
