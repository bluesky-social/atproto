import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, _ctx: AppContext) {
  server.com.atproto.account.get(() => {
    throw new InvalidRequestError('Not implemented')
  })
}
