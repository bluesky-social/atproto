import { CID } from 'multiformats/cid'
import { AppSokaaActorProfile } from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import { Database } from '../../db'
import { DatabaseSchema } from '../../db/database-schema'
import { ids } from '../collections'
import { RecordProcessor } from '../processor'
import { normalizeCreatedAt, stripNullBytes } from '../sanitizers'

type IndexedProfile = { did: string }

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  _cid: CID,
  obj: AppSokaaActorProfile.Record,
  timestamp: string,
): Promise<IndexedProfile | null> => {
  if (uri.rkey !== 'self') return null
  const did = uri.host
  await db
    .insertInto('actor')
    .values({
      did,
      displayName: stripNullBytes(obj.displayName),
      description: stripNullBytes(obj.description),
      avatarCid: obj.avatar?.ref.toString() ?? null,
      bannerCid: obj.banner?.ref.toString() ?? null,
      indexedAt: obj.createdAt ? normalizeCreatedAt(obj.createdAt) : timestamp,
    })
    .onConflict((oc) =>
      oc.column('did').doUpdateSet({
        displayName: stripNullBytes(obj.displayName),
        description: stripNullBytes(obj.description),
        avatarCid: obj.avatar?.ref.toString() ?? null,
        bannerCid: obj.banner?.ref.toString() ?? null,
        indexedAt: obj.createdAt
          ? normalizeCreatedAt(obj.createdAt)
          : timestamp,
      }),
    )
    .execute()
  return { did }
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedProfile | null> => {
  if (uri.rkey !== 'self') return null
  await db
    .updateTable('actor')
    .set({
      displayName: null,
      description: null,
      avatarCid: null,
      bannerCid: null,
    })
    .where('did', '=', uri.host)
    .execute()
  return { did: uri.host }
}

export type PluginType = RecordProcessor<
  AppSokaaActorProfile.Record,
  IndexedProfile
>

export const makePlugin = (db: Database): PluginType => {
  return new RecordProcessor(db, {
    lexId: ids.AppSokaaActorProfile,
    validate: (obj) => {
      AppSokaaActorProfile.validateRecord(obj)
    },
    insertFn,
    deleteFn,
  })
}
