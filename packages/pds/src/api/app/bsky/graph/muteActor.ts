import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActor({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const { actor } = input.body
      const requester = auth.credentials.did
      const { db, services } = ctx

      const subject = await services.account(db).getAccount(actor)
      if (!subject) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }
      if (subject.did === requester) {
        throw new InvalidRequestError('Cannot mute oneself')
      }

      await services.account(db).mute({
        did: subject.did,
        mutedByDid: requester,
      })
    },
  })
}
