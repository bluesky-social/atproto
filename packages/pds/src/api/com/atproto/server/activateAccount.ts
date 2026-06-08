import { INVALID_HANDLE } from '@atproto/syntax'
import {
  ForbiddenError,
  InvalidRequestError,
  Server,
} from '@atproto/xrpc-server'
import { AccountStatus } from '../../../../account-manager/account-manager.js'
import { ACCESS_FULL } from '../../../../auth-scope.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertValidDidDocumentForService } from './util.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const auth = ctx.authVerifier.authorization({
    scopes: ACCESS_FULL,
    authorize: () => {
      throw new ForbiddenError(
        'OAuth credentials are not supported for this endpoint',
      )
    },
  })

  if (entrywayClient) {
    // in the case of entryway, the full flow is activateAccount (PDS) -> activateAccount (Entryway) -> updateSubjectStatus(PDS)
    server.add(com.atproto.server.activateAccount, {
      auth,
      handler: async ({ req }) => {
        const { headers } = ctx.entrywayPassthruHeaders(req)
        await entrywayClient.xrpc(com.atproto.server.activateAccount, {
          headers,
        })
      },
    })
  } else {
    server.add(com.atproto.server.activateAccount, {
      auth,
      handler: async ({ auth }) => {
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
        const { status } = await ctx.accountManager.getAccountStatus(requester)
        if (status === AccountStatus.Deleted) {
          // A concurrent operation deleted the account
          throw new InvalidRequestError('user not found', 'AccountNotFound')
        }

        await ctx.sequencer.sequenceAccount(requester, status)
        await ctx.sequencer.sequenceIdentity(
          requester,
          account.handle ?? INVALID_HANDLE,
        )
        await ctx.sequencer.sequenceSync(requester, syncData)
      },
    })
  }
}
