import assert from 'node:assert'

import { check } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as plc from '@did-plc/lib'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.signPlcOperation({
    auth: ctx.authVerifier.accessFull(),
    handler: async ({ auth, input }) => {
      if (ctx.entrywayAgent) {
        assert(ctx.cfg.entryway)
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.identity.signPlcOperation(
            input.body,
            await ctx.serviceAuthHeaders(
              auth.credentials.did,
              ctx.cfg.entryway.did,
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
            input.body.verificationMethods ?? lastOp.verificationMethods,
          services: input.body.services ?? lastOp.services,
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
