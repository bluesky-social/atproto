import { InvalidRequestError } from '@atproto/xrpc-server'
import { TID, chunkArray, wait } from '@atproto/common'
import { Server } from '../../../lexicon'
import SqlRepoStorage from '../../../sql-repo-storage'
import AppContext from '../../../context'
import {
  BlockMap,
  CidSet,
  DataDiff,
  MST,
  MemoryBlockstore,
  def,
  signCommit,
} from '@atproto/repo'
import { CID } from 'multiformats/cid'
import { formatSeqCommit, sequenceEvt } from '../../../sequencer'
import { httpLogger as log } from '../../../logger'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.upgradeRepoVersion({
    auth: ctx.roleVerifier,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.admin) {
        throw new InvalidRequestError('must be admin')
      }
      const { did, force } = input.body

      await ctx.db.transaction(async (dbTxn) => {
        const storage = new SqlRepoStorage(dbTxn, did)
        await obtainLock(storage)
        const prevCid = await storage.getRoot()
        if (!prevCid) {
          throw new InvalidRequestError('Could not find repo')
        }
        const prev = await storage.readObj(prevCid, def.versionedCommit)
        const records = await dbTxn.db
          .selectFrom('record')
          .select(['collection', 'rkey', 'cid'])
          .where('did', '=', did)
          .execute()
        const memoryStore = new MemoryBlockstore()
        let data = await MST.create(memoryStore)
        for (const record of records) {
          const dataKey = record.collection + '/' + record.rkey
          const cid = CID.parse(record.cid)
          data = await data.add(dataKey, cid)
        }
        const dataCid = await data.getPointer()
        if (!force && !dataCid.equals(prev.data)) {
          throw new InvalidRequestError('Data cid did not match')
        }
        const recordCids = records.map((r) => r.cid)
        const diff = await DataDiff.of(data, null)
        const cidsToKeep = [...recordCids, ...diff.newMstBlocks.cids()]
        const rev = TID.nextStr(prev.rev)
        if (force) {
          const got = await storage.getBlocks(diff.newMstBlocks.cids())
          const toAdd = diff.newMstBlocks.getMany(got.missing)
          log.info(
            { missing: got.missing.length },
            'force added missing blocks',
          )
          // puts any new blocks & no-ops for already existing
          await storage.putMany(toAdd.blocks, rev)
        }
        for (const chunk of chunkArray(cidsToKeep, 500)) {
          const cidStrs = chunk.map((c) => c.toString())
          await dbTxn.db
            .updateTable('ipld_block')
            .set({ repoRev: rev })
            .where('creator', '=', did)
            .where('cid', 'in', cidStrs)
            .execute()
        }
        await dbTxn.db
          .deleteFrom('ipld_block')
          .where('creator', '=', did)
          .where((qb) =>
            qb.where('repoRev', 'is', null).orWhere('repoRev', '!=', rev),
          )
          .execute()
        await dbTxn.db
          .updateTable('repo_blob')
          .set({ repoRev: rev })
          .where('did', '=', did)
          .execute()
        await dbTxn.db
          .updateTable('record')
          .set({ repoRev: rev })
          .where('did', '=', did)
          .execute()
        const commit = await signCommit(
          {
            did,
            version: 3,
            rev: TID.nextStr(),
            prev: prevCid,
            data: dataCid,
          },
          ctx.repoSigningKey,
        )
        const newBlocks = new BlockMap()
        const commitCid = await newBlocks.add(commit)
        await storage.putMany(newBlocks, rev)
        await dbTxn.db
          .updateTable('repo_root')
          .set({
            root: commitCid.toString(),
            rev,
            indexedAt: storage.getTimestamp(),
          })
          .where('did', '=', did)
          .execute()

        const commitData = {
          cid: commitCid,
          rev,
          prev: prevCid,
          since: null,
          newBlocks,
          removedCids: new CidSet(),
        }
        const seqEvt = await formatSeqCommit(did, commitData, [])
        await sequenceEvt(dbTxn, seqEvt)
      })
    },
  })
}

const obtainLock = async (storage: SqlRepoStorage, tries = 20) => {
  const obtained = await storage.lockRepo()
  if (obtained) {
    return
  }
  if (tries < 1) {
    throw new InvalidRequestError('could not obtain lock')
  }
  await wait(50)
  return obtainLock(storage, tries - 1)
}
