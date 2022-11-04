import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Follow from '../../lexicon/types/app/bsky/graph/follow'
import { DbRecordPlugin, Notification } from '../types'
import * as schemas from '../schemas'

const type = schemas.ids.AppBskyGraphFollow
const tableName = 'app_bsky_follow'
export interface AppBskyFollow {
  uri: string
  cid: string
  creator: string
  subjectDid: string
  subjectDeclarationCid: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: AppBskyFollow }

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Follow.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const translateDbObj = (dbObj: AppBskyFollow): Follow.Record => {
  return {
    subject: {
      did: dbObj.subjectDid,
      declarationCid: dbObj.subjectDeclarationCid,
    },
    createdAt: dbObj.createdAt,
  }
}

const getFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<Follow.Record | null> => {
    const found = await db
      .selectFrom('app_bsky_follow')
      .selectAll()
      .where('uri', '=', uri.toString())
      .executeTakeFirst()
    return !found ? null : translateDbObj(found)
  }

const insertFn =
  (db: Kysely<PartialDB>) =>
  async (
    uri: AtUri,
    cid: CID,
    obj: unknown,
    timestamp?: string,
  ): Promise<void> => {
    if (!matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    const val = {
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subjectDid: obj.subject.did,
      subjectDeclarationCid: obj.subject.declarationCid,
      createdAt: obj.createdAt,
      indexedAt: timestamp || new Date().toISOString(),
    }
    await db.insertInto('app_bsky_follow').values(val).execute()
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<void> => {
    await db
      .deleteFrom('app_bsky_follow')
      .where('uri', '=', uri.toString())
      .execute()
  }

const notifsForRecord = (
  uri: AtUri,
  cid: CID,
  obj: unknown,
): Notification[] => {
  if (!matchesSchema(obj)) {
    throw new Error(`Record does not match schema: ${type}`)
  }
  const notif = {
    userDid: obj.subject.did,
    author: uri.host,
    recordUri: uri.toString(),
    recordCid: cid.toString(),
    reason: 'follow',
  }
  return [notif]
}

export const makePlugin = (
  db: Kysely<PartialDB>,
): DbRecordPlugin<Follow.Record, AppBskyFollow> => {
  return {
    collection: type,
    tableName,
    validateSchema,
    matchesSchema,
    translateDbObj,
    get: getFn(db),
    insert: insertFn(db),
    delete: deleteFn(db),
    notifsForRecord,
  }
}

export default makePlugin
