import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Profile from '../../../lexicon/types/app/bsky/actor/profile'
import * as lex from '../../../lexicon/lexicons'
import { Message } from '../../../event-stream/messages'
import DatabaseSchema from '../../../db/database-schema'
import RecordProcessor from '../processor'

const lexId = lex.ids.AppBskyActorProfile
type IndexedProfile = DatabaseSchema['profile']

const insertFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  cid: CID,
  obj: Profile.Record,
): Promise<IndexedProfile | null> => {
  if (uri.rkey !== 'self') return null
  const inserted = await db
    .insertInto('profile')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      displayName: obj.displayName,
      description: obj.description,
      avatarCid: obj.avatar?.cid,
      bannerCid: obj.banner?.cid,
      indexedAt: new Date().toISOString(),
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (): Promise<AtUri | null> => {
  return null
}

const eventsForInsert = (): Message[] => {
  return []
}

const deleteFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
): Promise<IndexedProfile | null> => {
  const deleted = await db
    .deleteFrom('profile')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const eventsForDelete = (): Message[] => {
  return []
}

export type PluginType = RecordProcessor<Profile.Record, IndexedProfile>

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
