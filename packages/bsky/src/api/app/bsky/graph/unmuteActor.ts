import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteActor({
    auth: ctx.authVerifier,
    handler: async ({ auth, input }) => {
      const { actor } = input.body
      const requester = auth.credentials.did
      const { db, services } = ctx

      const subjectDid = await services.actor(db).getActorDid(actor)
      if (!subjectDid) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }
      if (subjectDid === requester) {
        throw new InvalidRequestError('Cannot mute oneself')
      }

      await services.graph(db).unmuteActor({
        subjectDid,
        mutedByDid: requester,
      })
    },
  })
}
