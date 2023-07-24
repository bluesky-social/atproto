import { CID } from 'multiformats/cid'
import * as repo from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'
import { byteIterableToStream } from '@atproto/common'
import { isUserOrAdmin } from '../../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRecord({
    auth: ctx.optionalAccessOrRoleVerifier,
    handler: async ({ params, auth }) => {
      const { did, collection, rkey } = params
      // takedown check for anyone other than an admin or the user
      if (!isUserOrAdmin(auth, did)) {
        const available = await ctx.services
          .account(ctx.db)
          .isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
        }
      }
      const storage = new SqlRepoStorage(ctx.db, did)
      const commit = params.commit
        ? CID.parse(params.commit)
        : await storage.getHead()
      if (!commit) {
        throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
      }
      const proof = repo.getRecords(storage, commit, [{ collection, rkey }])
      return {
        encoding: 'application/vnd.ipld.car',
        body: byteIterableToStream(proof),
      }
    },
  })
}
