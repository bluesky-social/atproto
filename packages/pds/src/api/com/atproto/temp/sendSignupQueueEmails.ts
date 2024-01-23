import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { countAll } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.sendSignupQueueEmails({
    handler: async () => {
      throw new Error('unimplemented')
    },
  })
}
