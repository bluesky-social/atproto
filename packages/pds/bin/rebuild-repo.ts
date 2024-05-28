import { CID } from 'multiformats/cid'
import { ActorStoreTransactor } from '../src/actor-store'
import AppContext from '../src/context'
import {
  BlockMap,
  CidSet,
  MST,
  MemoryBlockstore,
  formatDataKey,
  signCommit,
} from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { TID } from '@atproto/common'

export const rebuildRepo = async (ctx: AppContext, did: string) => {
  const memoryStore = new MemoryBlockstore()
  const rev = TID.nextStr()
  const commit = await ctx.actorStore.transact(did, async (store) => {
    const [records, existingCids] = await Promise.all([
      listAllRecords(store),
      listExistingBlocks(store),
    ])
    let mst = await MST.create(memoryStore)
    for (const record of records) {
      mst = await mst.add(record.path, record.cid)
    }

    const mstCids = await mst.allCids()
    const toDelete = new CidSet(existingCids.toList()).subtractSet(mstCids)
    await store.repo.storage.deleteMany(toDelete.toList())
    const newCommit = await signCommit(
      {
        did,
        version: 3,
        rev,
        prev: null,
        data: await mst.getPointer(),
      },
      store.repo.signingKey,
    )
    // we only include the commit block in "new blocks" (which is what gets sequenced)
    const newBlocks = new BlockMap()
    const commitCid = await newBlocks.add(newCommit)
    const toAdd = memoryStore.blocks
    toAdd.addMap(newBlocks)
    await store.repo.storage.putMany(toAdd, rev)
    await store.repo.storage.updateRoot(commitCid, rev)
    return {
      cid: commitCid,
      rev,
      since: null,
      prev: null,
      newBlocks,
      removedCids: toDelete,
    }
  })
  await ctx.accountManager.updateRepoRoot(did, commit.cid, rev)
  await ctx.sequencer.sequenceCommit(did, commit, [])
}

const listExistingBlocks = async (
  store: ActorStoreTransactor,
): Promise<CidSet> => {
  const cids = new CidSet()
  let cursor: string | undefined = ''
  while (cursor) {
    const res = await store.db.db
      .selectFrom('repo_block')
      .select('cid')
      .where('cid', '>', cursor)
      .orderBy('cid', 'asc')
      .limit(1000)
      .execute()
    for (const row of res) {
      cids.add(CID.parse(row.cid))
    }
    cursor = res.at(-1)?.cid
  }
  return cids
}

const listAllRecords = async (
  store: ActorStoreTransactor,
): Promise<RecordDescript[]> => {
  const records: RecordDescript[] = []
  let cursor: string | undefined = ''
  while (cursor) {
    const res = await store.db.db
      .selectFrom('record')
      .select(['uri', 'cid'])
      .where('uri', '>', cursor)
      .orderBy('uri', 'asc')
      .limit(1000)
      .execute()
    for (const row of res) {
      const parsed = new AtUri(row.uri)
      records.push({
        uri: row.uri,
        path: formatDataKey(parsed.collection, parsed.rkey),
        cid: CID.parse(row.cid),
      })
    }
    cursor = res.at(-1)?.uri
  }
  return records
}

type RecordDescript = {
  uri: string
  path: string
  cid: CID
}
