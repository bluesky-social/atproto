import { InvalidRequestError } from '@atproto/xrpc-server'
import { TID } from '@atproto/common'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  BlockMap,
  Repo,
  WriteOpAction,
  readCarStream,
  verifyIncomingCarBlocks,
} from '@atproto/repo'
import { SqlRepoTransactor } from '../../../../actor-store/repo/sql-repo-transactor'
import { RecordTransactor } from '../../../../actor-store/record/transactor'
import { AtUri } from '@atproto/syntax'
import { Secp256k1Keypair } from '@atproto/crypto'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.importRepo({
    handler: async ({ params, input }) => {
      const { did } = params
      const car = await readCarStream(input.body)
      const roots = await car.getRoots()
      if (roots.length !== 1) {
        throw new InvalidRequestError('expected one root')
      }
      const prevCommitCid = roots[0]

      const keypair = await Secp256k1Keypair.create({ exportable: true })
      await ctx.actorStore.create(did, keypair, async () => {})
      const db = await ctx.actorStore.db(did)
      const now = new Date().toISOString()
      const repoTransactor = new SqlRepoTransactor(db, now)
      const recordTransactor = new RecordTransactor(db, ctx.blobstore(did))

      const rev = TID.nextStr()
      let blocks = new BlockMap()
      let count = 0
      let prevPromise = Promise.resolve()
      for await (const block of verifyIncomingCarBlocks(car.blocks())) {
        blocks.set(block.cid, block.bytes)
        count++
        if (count >= 100) {
          await prevPromise
          prevPromise = repoTransactor.putMany(blocks, rev)
          blocks = new BlockMap()
          count = 0
        }
      }
      await prevPromise
      await repoTransactor.putMany(blocks, rev)

      let repo = await Repo.load(repoTransactor, prevCommitCid)
      repo = await repo.resignCommit(rev, keypair)

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

      return {
        encoding: 'application/vnd.ipld.car',
        body: {} as any,
      }
    },
  })
}
