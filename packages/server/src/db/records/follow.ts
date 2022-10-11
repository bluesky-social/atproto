import { Kysely } from 'kysely'
import { AdxUri } from '@adxp/uri'
import * as Follow from '../../lexicon/types/todo/social/follow'
import { DbRecordPlugin, Notification } from '../types'
import schemas from '../schemas'

const type = 'todo.social.follow'
const tableName = 'todo_social_follow'
export interface TodoSocialFollow {
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

export type PartialDB = { [tableName]: TodoSocialFollow }

const validator = schemas.createRecordValidator(type)
const isValidSchema = (obj: unknown): obj is Follow.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const translateDbObj = (dbObj: TodoSocialFollow): Follow.Record => {
  return {
    subject: dbObj.subject,
    createdAt: dbObj.createdAt,
  }
}

const getFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AdxUri): Promise<Follow.Record | null> => {
    const found = await db
      .selectFrom('todo_social_follow')
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
    const val = {
      uri: uri.toString(),
      creator: uri.host,
      subject: obj.subject,
      createdAt: obj.createdAt,
      indexedAt: new Date().toISOString(),
    }
    await db.insertInto('todo_social_follow').values(val).execute()
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AdxUri): Promise<void> => {
    await db.deleteFrom('todo_social_follow').where('uri', '=', uri.toString())
  }

const notifsForRecord = (uri: AdxUri, obj: unknown): Notification[] => {
  if (!isValidSchema(obj)) {
    throw new Error(`Record does not match schema: ${type}`)
  }
  const notif = {
    userDid: obj.subject,
    author: uri.host,
    recordUri: uri.toString(),
    reason: 'follow',
  }
  return [notif]
}

export const makePlugin = (
  db: Kysely<PartialDB>,
): DbRecordPlugin<Follow.Record, TodoSocialFollow> => {
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
