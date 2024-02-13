import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.checkAccountStatus({
    auth: ctx.authVerifier.access,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const [repoRoot, indexedRecords, importedBlobs, expectedBlobs] =
        await ctx.actorStore.read(requester, async (store) => {
          return await Promise.all([
            store.repo.storage.getRootDetailed(),
            store.record.recordCount(),
            store.repo.blob.blobCount(),
            store.repo.blob.recordBlobCount(),
          ])
        })
      return {
        encoding: 'application/json',
        body: {
          activated: false,
          validDid: false,
          repoCommit: repoRoot.cid.toString(),
          repoRev: repoRoot.rev,
          indexedRecords,
          privateStateValues: 0,
          expectedBlobs,
          importedBlobs,
        },
      }
    },
  })
}
