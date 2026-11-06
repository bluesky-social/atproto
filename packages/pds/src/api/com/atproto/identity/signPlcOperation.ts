import * as plc from '@did-plc/lib'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import { ACCESS_FULL, AuthScope } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import {
  assertCanSignUpdatesForDid,
  serverRotationKeyDid,
} from '../server/util.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const auth = ctx.authVerifier.authorization({
    // @NOTE Should match auth rules from requestPlcOperationSignature
    scopes: ACCESS_FULL,
    additional: [AuthScope.Takendown],
    authorize: (permissions) => {
      permissions.assertIdentity({ attr: '*' })
    },
  })

  if (entrywayClient) {
    server.add(com.atproto.identity.signPlcOperation, {
      auth,
      handler: async ({ auth, input: { body }, req }) => {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.identity.signPlcOperation.$lxm,
        )

        return entrywayClient.xrpc(com.atproto.identity.signPlcOperation, {
          headers,
          body,
        })
      },
    })
  } else {
    server.add(com.atproto.identity.signPlcOperation, {
      auth,
      handler: async ({ auth, input }) => {
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

        if (!did.startsWith('did:plc:')) {
          throw new InvalidRequestError(
            'Cannot sign a PLC operation for a non-plc DID',
          )
        }
        const lastOp = await ctx.plcClient.getLastOp(did)
        assertCanSignUpdatesForDid(lastOp, serverRotationKeyDid(ctx))

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
                undefined | Record<string, string>) ??
              lastOp.verificationMethods,
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
}
