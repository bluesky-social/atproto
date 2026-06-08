import { CID } from 'multiformats/cid'
import { IdResolver } from '@atproto/identity'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { Database } from '../../src/data-plane/server/db'
import { IndexingService } from '../../src/data-plane/server/indexing'

export async function createTestDb(schema: string): Promise<Database> {
  const url = process.env.DB_POSTGRES_URL
  if (!url) throw new Error('Missing DB_POSTGRES_URL for indexing tests')
  const db = new Database({ url, schema, poolSize: 5 })
  await db.db.schema.dropSchema(schema).ifExists().cascade().execute()
  await db.migrateToLatestOrThrow()
  return db
}

export function createIndexingService(db: Database): IndexingService {
  const idResolver = new IdResolver()
  return new IndexingService(db, idResolver)
}

export async function indexCreate(
  svc: IndexingService,
  opts: {
    did: string
    collection: string
    rkey: string
    record: Record<string, unknown>
    cid?: CID
    timestamp?: string
  },
) {
  const uri = new AtUri(`${opts.did}/${opts.collection}/${opts.rkey}`)
  const cid =
    opts.cid ??
    CID.parse('bafyreief577qr2nxcsmx5gi536ftridv6p7zfkd4w2oacyl5xvzqzp36fy')
  const timestamp = opts.timestamp ?? new Date().toISOString()
  await svc.indexRecord(uri, cid, opts.record, WriteOpAction.Create, timestamp)
  return { uri, cid, timestamp }
}

export async function indexDelete(svc: IndexingService, uri: AtUri) {
  await svc.deleteRecord(uri)
}
