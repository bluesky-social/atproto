import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Like from '../../lexicon/types/app/bsky/like'
import { DbRecordPlugin, Notification } from '../types'
import * as schemas from '../schemas'

const type = schemas.ids.AppBskyLike
const tableName = 'app_bsky_like'

export interface AppBskyLike {
  uri: string
  cid: string
  creator: string
  subject: string
  subjectCid: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: AppBskyLike }

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Like.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const translateDbObj = (dbObj: AppBskyLike): Like.Record => {
  return {
    subject: {
      uri: dbObj.subject,
      cid: dbObj.subjectCid,
    },
    createdAt: dbObj.createdAt,
  }
}

const getFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<Like.Record | null> => {
    const found = await db
      .selectFrom('app_bsky_like')
      .selectAll()
      .where('uri', '=', uri.toString())
      .executeTakeFirst()
    return !found ? null : translateDbObj(found)
  }

const insertFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri, cid: CID, obj: unknown): Promise<void> => {
    if (!matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    await db
      .insertInto('app_bsky_like')
      .values({
        uri: uri.toString(),
        cid: cid.toString(),
        creator: uri.host,
        subject: obj.subject.uri,
        subjectCid: obj.subject.cid,
        createdAt: obj.createdAt,
        indexedAt: new Date().toISOString(),
      })
      .execute()
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<void> => {
    await db.deleteFrom('app_bsky_like').where('uri', '=', uri.toString())
  }

const notifsForRecord = (
  uri: AtUri,
  cid: CID,
  obj: unknown,
): Notification[] => {
  if (!matchesSchema(obj)) {
    throw new Error(`Record does not match schema: ${type}`)
  }
  const subjectUri = new AtUri(obj.subject.uri)
  const notif = {
    userDid: subjectUri.host,
    author: uri.host,
    recordUri: uri.toString(),
    recordCid: cid.toString(),
    reason: 'like',
    reasonSubject: subjectUri.toString(),
  }
  return [notif]
}

export const makePlugin = (
  db: Kysely<PartialDB>,
): DbRecordPlugin<Like.Record, AppBskyLike> => {
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
