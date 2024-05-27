import { CID } from 'multiformats/cid'
import { ActorStoreTransactor } from './actor-store'
import AppContext from './context'
import { MST, MemoryBlockstore, formatDataKey } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'

const run = async (ctx: AppContext, did: string) => {
  const memoryStore = new MemoryBlockstore()
  ctx.actorStore.transact(did, async (store) => {
    const records = await listAllRecords(store)
    let mst = await MST.create(memoryStore)
    for (const record of records) {
      mst = await mst.add(record.path, record.cid)
    }
  })
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
