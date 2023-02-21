import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmute({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const { user } = input.body
      const requester = auth.credentials.did
      const { db, services } = ctx

      const subject = await services.account(db).getUser(user)
      if (!subject) {
        throw new InvalidRequestError(`Actor not found: ${user}`)
      }

      await services.account(db).unmute({
        did: subject.did,
        mutedByDid: requester,
      })
    },
  })
}
