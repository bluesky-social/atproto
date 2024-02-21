import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import * as plc from '@did-plc/lib'
import { check } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.signPlcOperation({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ auth, input }) => {
      const did = auth.credentials.did
      const { token } = input.body
      if (!token) {
        throw new InvalidRequestError(
          'email confirmation token required to sign PLC operations',
        )
      }
      await ctx.services
        .account(ctx.db)
        .assertValidToken(did, 'plc_operation', token)

      const lastOp = await ctx.plcClient.getLastOp(did)
      if (check.is(lastOp, plc.def.tombstone)) {
        throw new InvalidRequestError('Did is tombstoned')
      }
      const operation = await plc.createUpdateOp(
        lastOp,
        ctx.plcRotationKey,
        (prev) => ({
          ...prev,
          rotationKeys: input.body.rotationKeys ?? prev.rotationKeys,
          alsoKnownAs: input.body.alsoKnownAs ?? prev.alsoKnownAs,
          verificationMethods:
            input.body.verificationMethods ?? prev.verificationMethods,
          services: input.body.services ?? prev.services,
        }),
      )
      return {
        encoding: 'application/json',
        body: {
          operation,
        },
      }
    },
  })
}
