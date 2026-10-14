import * as plc from '@did-plc/lib'
import { check } from '@atproto/common'
import { isPlainObject } from '@atproto/lex-data'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import { ACCESS_FULL, AuthScope } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

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

        // checked before the token is consumed so a bad request doesn't burn it
        const { verificationMethods, services } = input.body
        if (verificationMethods !== undefined) {
          if (!isPlainObject(verificationMethods)) {
            throw new InvalidRequestError(
              'verificationMethods must be an object',
            )
          }
          for (const [key, value] of Object.entries(verificationMethods)) {
            if (typeof value !== 'string') {
              throw new InvalidRequestError(
                `verificationMethods.${key} must be a string`,
              )
            }
            if (!value.startsWith('did:key:')) {
              throw new InvalidRequestError(
                `verificationMethods.${key} must start with "did:key:"`,
              )
            }
          }
        }

        if (services !== undefined) {
          if (!isPlainObject(services)) {
            throw new InvalidRequestError('services must be an object')
          }
          for (const [key, value] of Object.entries(services)) {
            if (!isPlainObject(value)) {
              throw new InvalidRequestError(`services.${key} must be an object`)
            }
            if (typeof value.type !== 'string') {
              throw new InvalidRequestError(
                `services.${key}.type must be a string`,
              )
            }
            if (typeof value.endpoint !== 'string') {
              throw new InvalidRequestError(
                `services.${key}.endpoint must be a string`,
              )
            }
          }
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
              (verificationMethods as undefined | Record<string, string>) ??
              lastOp.verificationMethods,
            services:
              (services as
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
