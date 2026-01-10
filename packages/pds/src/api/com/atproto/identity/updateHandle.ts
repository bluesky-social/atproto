import { DAY, MINUTE } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { httpLogger } from '../../../../logger'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.updateHandle({
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      authorize: (permissions) => {
        permissions.assertIdentity({ attr: 'handle' })
      },
    }),
    rateLimit: [
      {
        durationMs: 5 * MINUTE,
        points: 10,
        calcKey: ({ auth }) => auth.credentials.did,
      },
      {
        durationMs: DAY,
        points: 50,
        calcKey: ({ auth }) => auth.credentials.did,
      },
    ],
    handler: async ({ auth, input, req }) => {
      const requester = auth.credentials.did

      if (ctx.entrywayAgent) {
        // the full flow is:
        // -> entryway(identity.updateHandle) [update handle, submit plc op]
        // -> pds(admin.updateAccountHandle)  [track handle, sequence handle update]
        await ctx.entrywayAgent.com.atproto.identity.updateHandle(
          // @ts-expect-error "did" is not in the schema
          { did: requester, handle: input.body.handle },
          await ctx.entrywayAuthHeaders(
            req,
            auth.credentials.did,
            ids.ComAtprotoIdentityUpdateHandle,
          ),
        )
        return
      }

      const handle = await ctx.accountManager.normalizeAndValidateHandle(
        input.body.handle,
        { did: requester },
      )

      // Pessimistic check to handle spam: also enforced by updateHandle() and the db.
      const account = await ctx.accountManager.getAccount(handle, {
        includeDeactivated: true,
      })

      if (!account) {
        if (requester.startsWith('did:plc:')) {
          await ctx.plcClient.updateHandle(
            requester,
            ctx.plcRotationKey,
            handle,
          )
        } else {
          const resolved = await ctx.idResolver.did.resolveAtprotoData(
            requester,
            true,
          )
          if (resolved.handle !== handle) {
            throw new InvalidRequestError(
              'DID is not properly configured for handle',
            )
          }
        }
        await ctx.accountManager.updateHandle(requester, handle)
      } else {
        // if we found an account with matching handle, check if it is the same as requester
        // if so emit an identity event, otherwise error.
        if (account.did !== requester) {
          throw new InvalidRequestError(`Handle already taken: ${handle}`)
        }
      }

      try {
        await ctx.sequencer.sequenceIdentityEvt(requester, handle)
      } catch (err) {
        httpLogger.error(
          { err, did: requester, handle },
          'failed to sequence handle update',
        )
      }
    },
  })
}
