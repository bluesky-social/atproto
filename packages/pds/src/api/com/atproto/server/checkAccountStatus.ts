import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { isValidDidDocForService } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.checkAccountStatus, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // always allow
      },
    }),
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const [
        repoRoot,
        repoBlocks,
        indexedRecords,
        importedBlobs,
        expectedBlobs,
      ] = await ctx.actorStore.read(requester, async (store) => {
        return await Promise.all([
          store.repo.storage.getRootDetailed(),
          store.repo.storage.countBlocks(),
          store.record.recordCount(),
          store.repo.blob.blobCount(),
          store.repo.blob.recordBlobCount(),
        ])
      })
      const [activated, validDid] = await Promise.all([
        ctx.accountManager.isAccountActivated(requester),
        isValidDidDocForService(ctx, requester),
      ])

      return {
        encoding: 'application/json' as const,
        body: {
          activated,
          validDid,
          repoCommit: repoRoot.cid.toString(),
          repoRev: repoRoot.rev,
          repoBlocks,
          indexedRecords,
          privateStateValues: 0,
          expectedBlobs,
          importedBlobs,
        },
      }
    },
  })
}
