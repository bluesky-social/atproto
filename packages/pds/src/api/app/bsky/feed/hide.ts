import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.hide({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const { uri } = input.body
      const requester = auth.credentials.did
      const { db, services } = ctx
      
      await services.feed(db).hide({
        uri,
        hiddenByDid: requester,
      })
    },
  })
}

