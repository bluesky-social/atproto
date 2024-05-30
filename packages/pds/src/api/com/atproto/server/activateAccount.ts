import { CidSet } from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { INVALID_HANDLE } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { assertValidDidDocumentForService } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.activateAccount({
    auth: ctx.authVerifier.accessFull,
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

      const commitData = await ctx.actorStore.read(requester, async (store) => {
        const root = await store.repo.storage.getRootDetailed()
        const blocks = await store.repo.storage.getBlocks([root.cid])
        return {
          cid: root.cid,
          rev: root.rev,
          since: null,
          prev: null,
          newBlocks: blocks.blocks,
          removedCids: new CidSet(),
        }
      })

      // @NOTE: we're over-emitting for now for backwards compatibility, can reduce this in the future
      const status = await ctx.accountManager.getAccountStatus(requester)
      await ctx.sequencer.sequenceAccountEvt(requester, status)
      await ctx.sequencer.sequenceHandleUpdate(
        requester,
        account.handle ?? INVALID_HANDLE,
      )
      await ctx.sequencer.sequenceCommit(requester, commitData, [])
    },
  })
}
