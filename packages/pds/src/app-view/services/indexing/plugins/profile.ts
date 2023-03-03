import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Profile from '../../../../lexicon/types/app/bsky/actor/profile'
import * as lex from '../../../../lexicon/lexicons'
import {
  DatabaseSchema,
  DatabaseSchemaType,
} from '../../../../db/database-schema'
import RecordProcessor from '../processor'

const lexId = lex.ids.AppBskyActorProfile
type IndexedProfile = DatabaseSchemaType['profile']

const indexFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Profile.Record,
  timestamp: string,
): Promise<IndexedProfile | null> => {
  if (uri.rkey !== 'self') return null
  const profile = {
    uri: uri.toString(),
    cid: cid.toString(),
    creator: uri.host,
    displayName: obj.displayName,
    description: obj.description,
    avatarCid: obj.avatar?.cid,
    bannerCid: obj.banner?.cid,
    indexedAt: timestamp,
  }
  const inserted = await db
    .insertInto('profile')
    .values(profile)
    .onConflict((oc) => oc.doUpdateSet(profile))
    .returningAll()
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (): Promise<AtUri | null> => {
  return null
}

const eventsForIndex = () => {
  return []
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedProfile | null> => {
  const deleted = await db
    .deleteFrom('profile')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const eventsForDelete = () => {
  return []
}

export type PluginType = RecordProcessor<Profile.Record, IndexedProfile>

export const makePlugin = (db: DatabaseSchema): PluginType => {
  return new RecordProcessor(db, {
    lexId,
    indexFn,
    findDuplicate,
    deleteFn,
    eventsForIndex,
    eventsForDelete,
  })
}

export default makePlugin
