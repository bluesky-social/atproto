import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Vote from '../../../../lexicon/types/app/bsky/feed/vote'
import * as lex from '../../../../lexicon/lexicons'
import * as messages from '../../../../event-stream/messages'
import { Message } from '../../../../event-stream/messages'
import {
  DatabaseSchema,
  DatabaseSchemaType,
} from '../../../../db/database-schema'
import RecordProcessor from '../processor'

const lexId = lex.ids.AppBskyFeedVote
type IndexedVote = DatabaseSchemaType['vote']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Vote.Record,
  timestamp?: string,
): Promise<IndexedVote | null> => {
  if (obj.direction === 'up' || obj.direction === 'down') {
    const inserted = await db
      .insertInto('vote')
      .values({
        uri: uri.toString(),
        cid: cid.toString(),
        direction: obj.direction,
        creator: uri.host,
        subject: obj.subject.uri,
        subjectCid: obj.subject.cid,
        createdAt: obj.createdAt,
        indexedAt: timestamp || new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst()
    return inserted || null
  }
  return null
}

const findDuplicate = async (
  db: DatabaseSchema,
  uri: AtUri,
  obj: Vote.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('vote')
    .where('creator', '=', uri.host)
    .where('subject', '=', obj.subject.uri)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const createNotif = (obj: IndexedVote) => {
  const subjectUri = new AtUri(obj.subject)
  return messages.createNotification({
    userDid: subjectUri.host,
    author: obj.creator,
    recordUri: obj.uri,
    recordCid: obj.cid,
    reason: 'vote',
    reasonSubject: subjectUri.toString(),
  })
}

const eventsForInsert = (obj: IndexedVote) => {
  // No events for downvotes
  if (obj.direction === 'down') return []
  return [createNotif(obj)]
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedVote | null> => {
  const deleted = await db
    .deleteFrom('vote')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const eventsForDelete = (
  deleted: IndexedVote,
  replacedBy: IndexedVote | null,
): Message[] => {
  const events: Message[] = []
  if (deleted.direction !== replacedBy?.direction) {
    events.push(messages.deleteNotifications(deleted.uri))
    if (replacedBy) {
      events.push(createNotif(replacedBy))
    }
  }
  return events
}

export type PluginType = RecordProcessor<Vote.Record, IndexedVote>

export const makePlugin = (db: DatabaseSchema): PluginType => {
  return new RecordProcessor(db, {
    lexId,
    insertFn,
    findDuplicate,
    deleteFn,
    eventsForInsert,
    eventsForDelete,
  })
}

export default makePlugin
