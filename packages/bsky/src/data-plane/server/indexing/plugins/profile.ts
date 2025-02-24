import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import * as lex from '../../../../lexicon/lexicons'
import * as Profile from '../../../../lexicon/types/app/bsky/actor/profile'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

const lexId = lex.ids.AppBskyActorProfile
type IndexedProfile = DatabaseSchemaType['profile']

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Profile.Record,
  timestamp: string,
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
      avatarCid: obj.avatar?.ref.toString(),
      bannerCid: obj.banner?.ref.toString(),
      joinedViaStarterPackUri: obj.joinedViaStarterPack?.uri,
      createdAt: obj.createdAt ?? new Date().toISOString(),
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

const notifsForInsert = (obj: IndexedProfile) => {
  if (!obj.joinedViaStarterPackUri) return []
  const starterPackUri = new AtUri(obj.joinedViaStarterPackUri)
  return [
    {
      did: starterPackUri.host,
      author: obj.creator,
      recordUri: obj.uri,
      recordCid: obj.cid,
      reason: 'starterpack-joined' as const,
      reasonSubject: obj.joinedViaStarterPackUri,
      sortAt: obj.indexedAt,
    },
  ]
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

const notifsForDelete = () => {
  return { notifs: [], toDelete: [] }
}

export type PluginType = RecordProcessor<Profile.Record, IndexedProfile>

export const makePlugin = (
  db: Database,
  background: BackgroundQueue,
): PluginType => {
  return new RecordProcessor(db, background, {
    lexId,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
