import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { assertValidDidDocumentForService } from './util'
import { CidSet } from '@atproto/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.activateAccount({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did

      await assertValidDidDocumentForService(ctx, requester)

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

      await ctx.sequencer.sequenceCommit(requester, commitData, [])
    },
  })
}
