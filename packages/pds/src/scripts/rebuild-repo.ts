import readline from 'node:readline/promises'
import { CID } from 'multiformats/cid'
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
import { ActorStoreTransactor } from '../actor-store'
import AppContext from '../context'

export const rebuildRepo = async (ctx: AppContext, args: string[]) => {
  const did = args[0]
  if (!did || !did.startsWith('did:')) {
    throw new Error('Expected DID as argument')
  }

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
    const newBlocks = new BlockMap()
    for await (const node of mst.walk()) {
      if (node.isTree()) {
        const pointer = await node.getPointer()
        if (!existingCids.has(pointer)) {
          const serialized = await node.serialize()
          newBlocks.set(serialized.cid, serialized.bytes)
        }
      }
    }
    const mstCids = await mst.allCids()
    const toDelete = new CidSet(existingCids.toList()).subtractSet(mstCids)
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
    const commitCid = await newBlocks.add(newCommit)

    console.log('Record count: ', records.length)
    console.log('Existing blocks: ', existingCids.toList().length)
    console.log('Deleting blocks:', toDelete.toList().length)
    console.log('Adding blocks: ', newBlocks.size)

    const shouldContinue = await promptContinue()
    if (!shouldContinue) {
      throw new Error('Aborted')
    }

    await store.repo.storage.deleteMany(toDelete.toList())
    await store.repo.storage.putMany(newBlocks, rev)
    await store.repo.storage.updateRoot(commitCid, rev)
    return {
      cid: commitCid,
      rev,
      since: null,
      prev: null,
      newBlocks,
      relevantBlocks: newBlocks,
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
  while (cursor !== undefined) {
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
  while (cursor !== undefined) {
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

const promptContinue = async (): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const answer = await rl.question('Continue? y/n ')
  return answer === ''
}

type RecordDescript = {
  uri: string
  path: string
  cid: CID
}
