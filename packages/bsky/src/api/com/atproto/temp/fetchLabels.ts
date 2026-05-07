import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, _ctx: AppContext) {
  server.add(com.atproto.temp.fetchLabels, async (_reqCtx) => {
    throw new InvalidRequestError('not implemented on dataplane')
  })
}
