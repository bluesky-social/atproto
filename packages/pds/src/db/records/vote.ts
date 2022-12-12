import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Vote from '../../lexicon/types/app/bsky/feed/vote'
import { Vote as IndexedVote } from '../tables/vote'
import * as lex from '../../lexicon/lexicons'
import * as messages from '../message-queue/messages'
import { Message } from '../message-queue/messages'
import { DatabaseSchema } from '../database-schema'
import RecordProcessor from '../record-processor'

const lexId = lex.ids.AppBskyFeedVote

const insertFn = async (
  db: Kysely<DatabaseSchema>,
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
  db: Kysely<DatabaseSchema>,
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

const createNotif = (obj: IndexedVote): Message => {
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

const eventsForInsert = (obj: IndexedVote): Message[] => {
  // No events for downvotes
  if (obj.direction === 'down') return []
  return [createNotif(obj), messages.addUpvote(obj.creator, obj.subject)]
}

const deleteFn = async (
  db: Kysely<DatabaseSchema>,
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
  if (deleted.direction === 'up' && replacedBy?.direction !== 'up') {
    events.push(messages.removeUpvote(deleted.creator, deleted.subject))
  }
  if (replacedBy?.direction === 'up' && deleted.direction !== 'up') {
    events.push(messages.addUpvote(replacedBy.creator, replacedBy.subject))
  }
  return events
}

export type PluginType = RecordProcessor<Vote.Record, IndexedVote>

export const makePlugin = (db: Kysely<DatabaseSchema>): PluginType => {
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
