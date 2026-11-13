import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, _ctx: AppContext) {
  server.add(com.atproto.temp.fetchLabels, async (_reqCtx) => {
    throw new InvalidRequestError('not implemented on dataplane')
  })
}
