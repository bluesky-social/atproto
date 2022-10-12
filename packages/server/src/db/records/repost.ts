import { Kysely } from 'kysely'
import { AdxUri } from '@adxp/uri'
import * as Repost from '../../lexicon/types/app/bsky/repost'
import { DbRecordPlugin, Notification } from '../types'
import schemas from '../schemas'

const type = 'app.bsky.repost'
const tableName = 'app_bsky_repost'

export interface AppBskyRepost {
  uri: string
  creator: string
  subject: string
  createdAt: string
  indexedAt: string
}

export const createTable = async (db: Kysely<PartialDB>): Promise<void> => {
  await db.schema
    .createTable(tableName)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
}

export type PartialDB = { [tableName]: AppBskyRepost }

const validator = schemas.createRecordValidator(type)
const isValidSchema = (obj: unknown): obj is Repost.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const translateDbObj = (dbObj: AppBskyRepost): Repost.Record => {
  return {
    subject: dbObj.subject,
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
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!isValidSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    await db
      .insertInto('app_bsky_repost')
      .values({
        uri: uri.toString(),
        creator: uri.host,
        subject: obj.subject,
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

const notifsForRecord = (uri: AdxUri, obj: unknown): Notification[] => {
  if (!isValidSchema(obj)) {
    throw new Error(`Record does not match schema: ${type}`)
  }
  const subjectUri = new AdxUri(obj.subject)
  const notif = {
    userDid: subjectUri.host,
    author: uri.host,
    recordUri: uri.toString(),
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
    translateDbObj,
    get: getFn(db),
    insert: insertFn(db),
    delete: deleteFn(db),
    notifsForRecord,
  }
}

export default makePlugin
