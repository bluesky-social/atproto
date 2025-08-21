import * as plc from '@did-plc/lib'
import { check } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ACCESS_FULL, AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.signPlcOperation({
    auth: ctx.authVerifier.authorization({
      // @NOTE Should match auth rules from requestPlcOperationSignature
      scopes: ACCESS_FULL,
      additional: [AuthScope.Takendown],
      authorize: (permissions) => {
        permissions.assertIdentity({ attr: '*' })
      },
    }),
    handler: async ({ auth, input, req }) => {
      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.identity.signPlcOperation(
            input.body,
            await ctx.entrywayAuthHeaders(
              req,
              auth.credentials.did,
              ids.ComAtprotoIdentitySignPlcOperation,
            ),
          ),
        )
      }

      const did = auth.credentials.did
      const { token } = input.body
      if (!token) {
        throw new InvalidRequestError(
          'email confirmation token required to sign PLC operations',
        )
      }
      await ctx.accountManager.assertValidEmailTokenAndCleanup(
        did,
        'plc_operation',
        token,
      )

      const lastOp = await ctx.plcClient.getLastOp(did)
      if (check.is(lastOp, plc.def.tombstone)) {
        throw new InvalidRequestError('Did is tombstoned')
      }
      const operation = await plc.createUpdateOp(
        lastOp,
        ctx.plcRotationKey,
        (lastOp) => ({
          ...lastOp,
          rotationKeys: input.body.rotationKeys ?? lastOp.rotationKeys,
          alsoKnownAs: input.body.alsoKnownAs ?? lastOp.alsoKnownAs,
          verificationMethods:
            // @TODO: actually validate instead of type casting
            (input.body.verificationMethods as
              | undefined
              | Record<string, string>) ?? lastOp.verificationMethods,
          services:
            // @TODO: actually validate instead of type casting
            (input.body.services as
              | undefined
              | Record<string, { type: string; endpoint: string }>) ??
            lastOp.services,
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
