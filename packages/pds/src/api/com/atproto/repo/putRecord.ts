import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, _ctx: AppContext) {
  server.com.atproto.repo.putRecord(async () => {
    throw new InvalidRequestError(`Updates are not yet supported.`)
  })
}
