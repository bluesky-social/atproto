import * as plc from '@did-plc/lib'
import { check } from '@atproto/common'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { ACCESS_FULL, AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx
  server.add(com.atproto.identity.signPlcOperation, {
    auth: ctx.authVerifier.authorization({
      // @NOTE Should match auth rules from requestPlcOperationSignature
      scopes: ACCESS_FULL,
      additional: [AuthScope.Takendown],
      authorize: (permissions) => {
        permissions.assertIdentity({ attr: '*' })
      },
    }),
    handler: entrywayClient
      ? async ({ auth, input: { body }, req }) => {
          const { headers } = await ctx.entrywayAuthHeaders(
            req,
            auth.credentials.did,
            com.atproto.identity.signPlcOperation.$lxm,
          )

          return entrywayClient.xrpc(com.atproto.identity.signPlcOperation, {
            validateResponse: false, // ignore invalid upstream responses
            headers,
            body,
          })
        }
      : async ({ auth, input }) => {
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
            encoding: 'application/json' as const,
            body: { operation },
          }
        },
  })
}
