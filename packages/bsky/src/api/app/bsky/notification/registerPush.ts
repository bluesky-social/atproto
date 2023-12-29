import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.registerPush({
    auth: ctx.authVerifier,
    handler: async ({ auth, input }) => {
      const { serviceDid } = input.body
      if (serviceDid !== auth.artifacts.aud) {
        throw new InvalidRequestError('Invalid serviceDid.')
      }
      // @TODO fix pending appview v2 buildout
      throw new InvalidRequestError('not currently supported')
    },
  })
}
