import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import * as plc from '@did-plc/lib'
import { check } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.signPlcOp({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, input }) => {
      const did = auth.credentials.did
      const lastOp = await ctx.plcClient.getLastOp(did)
      if (check.is(lastOp, plc.def.tombstone)) {
        throw new InvalidRequestError('Did is tombstoned')
      }
      const op = await plc.createUpdateOp(
        lastOp,
        ctx.plcRotationKey,
        (lastOp) => ({
          ...lastOp,
          rotationKeys: input.body.rotationKeys ?? lastOp.rotationKeys,
          alsoKnownAs: input.body.alsoKnownAs ?? lastOp.alsoKnownAs,
          verificationMethods:
            input.body.verificationMethods ?? lastOp.verificationMethods,
          services: input.body.services ?? lastOp.services,
        }),
      )
      return {
        encoding: 'application/json',
        body: {
          plcOp: op,
        },
      }
    },
  })
}
