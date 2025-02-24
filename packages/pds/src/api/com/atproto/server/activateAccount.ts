import { CidSet } from '@atproto/repo'
import { INVALID_HANDLE } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { authPassthru } from '../../../proxy'
import { assertValidDidDocumentForService } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.activateAccount({
    auth: ctx.authVerifier.accessFull(),
    handler: async ({ req, auth }) => {
      // in the case of entryway, the full flow is activateAccount (PDS) -> activateAccount (Entryway) -> updateSubjectStatus(PDS)
      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.activateAccount(
          undefined,
          authPassthru(req),
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

      const commitData = await ctx.actorStore.read(requester, async (store) => {
        const root = await store.repo.storage.getRootDetailed()
        const blocks = await store.repo.storage.getBlocks([root.cid])
        return {
          cid: root.cid,
          rev: root.rev,
          since: null,
          prev: null,
          newBlocks: blocks.blocks,
          relevantBlocks: blocks.blocks,
          removedCids: new CidSet(),
          ops: [],
          blobs: new CidSet(),
          prevData: null,
        }
      })

      // @NOTE: we're over-emitting for now for backwards compatibility, can reduce this in the future
      const status = await ctx.accountManager.getAccountStatus(requester)
      await ctx.sequencer.sequenceAccountEvt(requester, status)
      await ctx.sequencer.sequenceIdentityEvt(
        requester,
        account.handle ?? INVALID_HANDLE,
      )
      await ctx.sequencer.sequenceCommit(requester, commitData)
    },
  })
}
