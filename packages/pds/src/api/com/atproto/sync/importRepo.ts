import stream from 'stream'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { byteIterableToStream } from '@atproto/common'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  RepoRootNotFoundError,
  SqlRepoReader,
} from '../../../../actor-store/repo/sql-repo-reader'
import {
  BlockMap,
  Commit,
  WriteOpAction,
  def,
  readCarStream,
  verifyIncomingCarBlocks,
} from '@atproto/repo'
import { SqlRepoTransactor } from '../../../../actor-store/repo/sql-repo-transactor'
import { report } from 'process'
import ReadableRepo from '@atproto/repo/src/readable-repo'
import { RecordTransactor } from '../../../../actor-store/record/transactor'
import { AtUri } from '@atproto/syntax'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.importRepo({
    handler: async ({ params, auth, input }) => {
      const { did } = params
      const car = await readCarStream(input.body)
      const roots = await car.getRoots()
      if (roots.length !== 1) {
        throw new InvalidRequestError('expected one root')
      }
      const commitCid = roots[0]

      await ctx.actorStore.create(did, async () => {})
      const db = await ctx.actorStore.db(did)
      const now = new Date().toISOString()
      const repoTransactor = new SqlRepoTransactor(db, now)
      const recordTransactor = new RecordTransactor(db, ctx.blobstore(did))

      for await (const block of verifyIncomingCarBlocks(car.blocks())) {
        await repoTransactor.putBlock(block.cid, block.bytes, '')
      }
      const repo = await ReadableRepo.load(repoTransactor, commitCid)
      await repoTransactor.updateRoot(repo.cid, repo.commit.rev)

      for await (const entry of repo.walkRecords()) {
        const uri = AtUri.make(did, entry.collection, entry.rkey)
        await recordTransactor.indexRecord(
          uri,
          entry.cid,
          entry.record,
          WriteOpAction.Create,
          repo.commit.rev,
          now,
        )
      }
      // takedown check for anyone other than an admin or the user
      if (!ctx.authVerifier.isUserOrAdmin(auth, did)) {
        const available = await ctx.services
          .account(ctx.db)
          .isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
        }
      }

      const carStream = await getCarStream(ctx, did, since)

      return {
        encoding: 'application/vnd.ipld.car',
        body: carStream,
      }
    },
  })
}
