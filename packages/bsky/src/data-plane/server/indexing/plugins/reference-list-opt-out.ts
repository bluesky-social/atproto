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

type IndexedReferenceListOptOut = Selectable<
  DatabaseSchemaType['reference_list_opt_out']
>

const parseSubject = (subject: string): AtUri | null => {
  try {
    const uri = new AtUri(subject)
    if (
      !uri.did ||
      !uri.rkeySafe ||
      uri.collection !== app.bsky.graph.list.$type ||
      uri.pathname.split('/').filter(Boolean).length !== 2 ||
      uri.search ||
      uri.hash ||
      uri.toString() !== subject
    ) {
      return null
    }
    return uri
  } catch {
    return null
  }
}

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: Cid,
  obj: app.bsky.graph.referencelistoptout.Main,
  timestamp: string,
): Promise<IndexedReferenceListOptOut | null> => {
  const subject = parseSubject(obj.subject)
  if (!subject) return null
  const inserted = await db
    .insertInto('reference_list_opt_out')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subjectUri: subject.toString(),
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
  obj: app.bsky.graph.referencelistoptout.Main,
): Promise<AtUri | null> => {
  const subject = parseSubject(obj.subject)
  if (!subject) return null
  const found = await db
    .selectFrom('reference_list_opt_out')
    .where('creator', '=', uri.host)
    .where('subjectUri', '=', subject.toString())
    .select('uri')
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedReferenceListOptOut | null> => {
  const deleted = await db
    .deleteFrom('reference_list_opt_out')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

export type PluginType = ReturnType<typeof makePlugin>
export const makePlugin = (
  db: Database,
  background: BackgroundQueue<Database>,
) => {
  return new RecordProcessor(db, background, {
    schema: app.bsky.graph.referencelistoptout.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert: () => [],
    notifsForDelete: () => ({ notifs: [], toDelete: [] }),
    promoteDuplicateOnDelete: false,
  })
}

export default makePlugin
