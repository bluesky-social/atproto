import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.uploadBlob, {
    auth: ctx.authVerifier.authorization({ authorize: () => {} }),
    handler: async () => {
      throw new Error('Not yet implemented')
    },
  })
}
