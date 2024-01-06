import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.registerPush({
    auth: ctx.authVerifier,
    handler: async () => {
      // @TODO for appview v2
      throw new Error('unimplemented')
    },
  })
}
