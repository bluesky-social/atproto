import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import * as plc from '@did-plc/lib'
import { check } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.sendPlcOp({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, input, req }) => {
      const did = auth.credentials.did
      const op = input.body.op

      if (!check.is(op, plc.def.opOrTombstone)) {
        throw new InvalidRequestError('Invalid request')
      }

      // @TODO verify op is correct

      await ctx.plcClient.sendOperation(did, op)
    },
  })
}
