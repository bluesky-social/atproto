import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { assertValidDidDocumentForService } from './util'
import { BlockMap, CidSet } from '@atproto/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.activateAccount({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did

      await assertValidDidDocumentForService(ctx, requester)

      await ctx.accountManager.activateAccount(requester)

      const root = await ctx.actorStore.read(requester, (store) =>
        store.repo.storage.getRootDetailed(),
      )
      const commitData = {
        cid: root.cid,
        rev: root.rev,
        since: null,
        prev: null,
        newBlocks: new BlockMap(),
        removedCids: new CidSet(),
      }

      await ctx.sequencer.sequenceCommit(requester, commitData, [])
    },
  })
}
