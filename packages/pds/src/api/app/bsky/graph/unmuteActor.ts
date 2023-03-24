import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteActor({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const { actor } = input.body
      const requester = auth.credentials.did
      const { db, services } = ctx

      const subject = await services.account(db).getAccount(actor)
      if (!subject) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      await services.account(db).unmute({
        did: subject.did,
        mutedByDid: requester,
      })
    },
  })
}
