import type { Selectable } from 'kysely'
import type { Cid } from '@atproto/lex'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { app } from '../../../../lexicons/index.js'
import type { BackgroundQueue } from '../../background.js'
import type {
  DatabaseSchema,
  DatabaseSchemaType,
} from '../../db/database-schema.js'
import type { Database } from '../../db/index.js'
import { RecordProcessor } from '../processor.js'

type IndexedBlock = Selectable<DatabaseSchemaType['actor_block']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: Cid,
  obj: app.bsky.graph.block.Main,
  timestamp: string,
): Promise<IndexedBlock | null> => {
  const inserted = await db
    .insertInto('actor_block')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subjectDid: obj.subject,
      createdAt: normalizeDatetimeAlways(obj.createdAt),
      indexedAt: timestamp,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (
  db: DatabaseSchema,
  uri: AtUri,
  obj: app.bsky.graph.block.Main,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('actor_block')
    .where('creator', '=', uri.host)
    .where('subjectDid', '=', obj.subject)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const notifsForInsert = () => {
  return []
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedBlock | null> => {
  const deleted = await db
    .deleteFrom('actor_block')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = ReturnType<typeof makePlugin>
export const makePlugin = (
  db: Database,
  background: BackgroundQueue<Database>,
) => {
  return new RecordProcessor(db, background, {
    schema: app.bsky.graph.block.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
