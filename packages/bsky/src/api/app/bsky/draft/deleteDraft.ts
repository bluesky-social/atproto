import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Namespaces } from '../../../../stash'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.draft.deleteDraft({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const actorDid = auth.credentials.iss
      const { id } = input.body

      await ctx.stashClient.delete({
        actorDid,
        namespace: Namespaces.AppBskyDraftDefsDraftWithId,
        key: id,
      })
    },
  })
}
