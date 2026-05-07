import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons'
import { Namespaces } from '../../../../stash'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.draft.deleteDraft, {
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
