import { MethodNotImplementedError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'

export default function (server: Server, _ctx: AppContext) {
  server.add(app.bsky.embed.getEmbedExternalView, {
    handler: async () => {
      throw new MethodNotImplementedError()
    },
  })
}
