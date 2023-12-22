import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActor({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const { actor } = input.body
      const requester = auth.credentials.iss
      const db = ctx.db.getPrimary()

      const subjectDid = await ctx.services.actor(db).getActorDid(actor)
      if (!subjectDid) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }
      if (subjectDid === requester) {
        throw new InvalidRequestError('Cannot mute oneself')
      }

      await ctx.services.graph(db).muteActor({
        subjectDid,
        mutedByDid: requester,
      })
    },
  })
}
