import { Kysely } from 'kysely'
import { AdxUri } from '@adxp/uri'
import * as Repost from '../../lexicon/types/app/bsky/repost'
import { DbRecordPlugin, Notification } from '../types'
import * as schemas from '../schemas'
import { CID } from '@adxp/common'

const type = schemas.ids.AppBskyRepost
const tableName = 'app_bsky_repost'

export interface AppBskyRepost {
  uri: string
  cid: string
  creator: string
  subject: string
  subjectCid: string
  createdAt: string
  indexedAt: string
}

export const createTable = async (db: Kysely<PartialDB>): Promise<void> => {
  await db.schema
    .createTable(tableName)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
}

export type PartialDB = { [tableName]: AppBskyRepost }

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Repost.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const translateDbObj = (dbObj: AppBskyRepost): Repost.Record => {
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
  async (uri: AdxUri): Promise<Repost.Record | null> => {
    const found = await db
      .selectFrom('app_bsky_repost')
      .selectAll()
      .where('uri', '=', uri.toString())
      .executeTakeFirst()
    return !found ? null : translateDbObj(found)
  }

const insertFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AdxUri, cid: CID, obj: unknown): Promise<void> => {
    if (!matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    await db
      .insertInto('app_bsky_repost')
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
  async (uri: AdxUri): Promise<void> => {
    await db.deleteFrom('app_bsky_repost').where('uri', '=', uri.toString())
  }

const notifsForRecord = (
  uri: AdxUri,
  cid: CID,
  obj: unknown,
): Notification[] => {
  if (!matchesSchema(obj)) {
    throw new Error(`Record does not match schema: ${type}`)
  }
  const subjectUri = new AdxUri(obj.subject.uri)
  const notif = {
    userDid: subjectUri.host,
    author: uri.host,
    recordUri: uri.toString(),
    recordCid: cid.toString(),
    reason: 'repost',
    reasonSubject: subjectUri.toString(),
  }
  return [notif]
}

export const makePlugin = (
  db: Kysely<PartialDB>,
): DbRecordPlugin<Repost.Record, AppBskyRepost> => {
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
