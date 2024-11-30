import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, _ctx: AppContext) {
  server.com.atproto.temp.fetchLabels(async (_reqCtx) => {
    throw new InvalidRequestError('not implemented on dataplane')
  })
}
