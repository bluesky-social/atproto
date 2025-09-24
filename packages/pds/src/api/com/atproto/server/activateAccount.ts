import { INVALID_HANDLE } from '@atproto/syntax'
import { ForbiddenError, InvalidRequestError } from '@atproto/xrpc-server'
import { ACCESS_FULL } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertValidDidDocumentForService } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.activateAccount({
    auth: ctx.authVerifier.authorization({
      scopes: ACCESS_FULL,
      authorize: () => {
        throw new ForbiddenError(
          'OAuth credentials are not supported for this endpoint',
        )
      },
    }),
    handler: async ({ req, auth }) => {
      // in the case of entryway, the full flow is activateAccount (PDS) -> activateAccount (Entryway) -> updateSubjectStatus(PDS)
      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.activateAccount(
          undefined,
          ctx.entrywayPassthruHeaders(req),
        )
        return
      }

      const requester = auth.credentials.did

      await assertValidDidDocumentForService(ctx, requester)

      const account = await ctx.accountManager.getAccount(requester, {
        includeDeactivated: true,
      })
      if (!account) {
        throw new InvalidRequestError('user not found', 'AccountNotFound')
      }

      await ctx.accountManager.activateAccount(requester)

      const syncData = await ctx.actorStore.read(requester, (store) =>
        store.repo.getSyncEventData(),
      )

      // @NOTE: we're over-emitting for now for backwards compatibility, can reduce this in the future
      const status = await ctx.accountManager.getAccountStatus(requester)
      await ctx.sequencer.sequenceAccountEvt(requester, status)
      await ctx.sequencer.sequenceIdentityEvt(
        requester,
        account.handle ?? INVALID_HANDLE,
      )
      await ctx.sequencer.sequenceSyncEvt(requester, syncData)
    },
  })
}
