import { Selectable } from 'kysely'
import { Cid } from '@atproto/lex'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { app } from '../../../../lexicons/index.js'
import { BackgroundQueue } from '../../background.js'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema.js'
import { Database } from '../../db/index.js'
import { RecordProcessor } from '../processor.js'

type IndexedPoll = Selectable<DatabaseSchemaType['poll']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: Cid,
  obj: app.bsky.poll.topic.Main,
  timestamp: string,
): Promise<IndexedPoll | null> => {
  const inserted = await db
    .insertInto('poll')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      endsAt: obj.endsAt ? normalizeDatetimeAlways(obj.endsAt) : null,
      createdAt: normalizeDatetimeAlways(obj.createdAt),
      indexedAt: timestamp,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (): Promise<AtUri | null> => {
  return null
}

const notifsForInsert = () => {
  return []
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedPoll | null> => {
  const deleted = await db
    .deleteFrom('poll')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = ReturnType<typeof makePlugin>
export const makePlugin = (db: Database, background: BackgroundQueue) => {
  return new RecordProcessor(db, background, {
    schema: app.bsky.poll.topic.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
