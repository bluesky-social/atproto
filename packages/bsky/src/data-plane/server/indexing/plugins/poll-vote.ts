import { Selectable } from 'kysely'
import { Cid } from '@atproto/lex'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { app } from '../../../../lexicons/index.js'
import { BackgroundQueue } from '../../background.js'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema.js'
import { Database } from '../../db/index.js'
import { countAll, excluded } from '../../db/util.js'
import { RecordProcessor } from '../processor.js'

type IndexedPollVote = Selectable<DatabaseSchemaType['poll_vote']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: Cid,
  obj: app.bsky.poll.vote.Main,
  timestamp: string,
): Promise<IndexedPollVote | null> => {
  const createdAt = normalizeDatetimeAlways(obj.createdAt)

  // Don't count votes cast after the poll has closed. If the poll record
  // hasn't been indexed yet we index optimistically (no endsAt to compare).
  const poll = await db
    .selectFrom('poll')
    .where('uri', '=', obj.subject.uri)
    .select('endsAt')
    .executeTakeFirst()
  if (poll?.endsAt && createdAt > poll.endsAt) {
    return null
  }

  const inserted = await db
    .insertInto('poll_vote')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subject: obj.subject.uri,
      subjectCid: obj.subject.cid,
      option: obj.option,
      createdAt,
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
  obj: app.bsky.poll.vote.Main,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('poll_vote')
    .where('creator', '=', uri.host)
    .where('subject', '=', obj.subject.uri)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const notifsForInsert = () => {
  // Per-vote notifications are intentionally not emitted; the poll author and
  // voters are notified once when the poll closes (see poll-closer.ts).
  return []
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedPollVote | null> => {
  const deleted = await db
    .deleteFrom('poll_vote')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = (
  deleted: IndexedPollVote,
  replacedBy: IndexedPollVote | null,
) => {
  const toDelete = replacedBy ? [] : [deleted.uri]
  return { notifs: [], toDelete }
}

const updateAggregates = async (db: DatabaseSchema, vote: IndexedPollVote) => {
  await db
    .insertInto('poll_option_agg')
    .values({
      pollUri: vote.subject,
      option: vote.option,
      voteCount: db
        .selectFrom('poll_vote')
        .where('poll_vote.subject', '=', vote.subject)
        .where('poll_vote.option', '=', vote.option)
        .select(countAll.as('count')),
    })
    .onConflict((oc) =>
      oc
        .columns(['pollUri', 'option'])
        .doUpdateSet({ voteCount: excluded(db, 'voteCount') }),
    )
    .execute()
}

export type PluginType = ReturnType<typeof makePlugin>
export const makePlugin = (db: Database, background: BackgroundQueue) => {
  return new RecordProcessor(db, background, {
    schema: app.bsky.poll.vote.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
    updateAggregates,
  })
}

export default makePlugin
