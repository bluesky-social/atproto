import { Kysely } from 'kysely'
import { AdxUri } from '@adxp/uri'
import * as Repost from '../../lexicon/types/todo/social/repost'
import { DbRecordPlugin, Notification } from '../types'
import schemas from '../schemas'

const type = 'todo.social.repost'
const tableName = 'todo_social_repost'

export interface TodoSocialRepost {
  uri: string
  creator: string
  subject: string
  createdAt: string
  indexedAt: string
}

type PartialDB = Kysely<{ [tableName]: TodoSocialRepost }>

const validator = schemas.createRecordValidator(type)
const isValidSchema = (obj: unknown): obj is Repost.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const translateDbObj = (dbObj: TodoSocialRepost): Repost.Record => {
  return {
    subject: dbObj.subject,
    createdAt: dbObj.createdAt,
  }
}

const getFn =
  (db: PartialDB) =>
  async (uri: AdxUri): Promise<Repost.Record | null> => {
    const found = await db
      .selectFrom('todo_social_repost')
      .selectAll()
      .where('uri', '=', uri.toString())
      .executeTakeFirst()
    return !found ? null : translateDbObj(found)
  }

const setFn =
  (db: PartialDB) =>
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
    await db.insertInto('todo_social_repost').values(val).execute()
  }

const deleteFn =
  (db: PartialDB) =>
  async (uri: AdxUri): Promise<void> => {
    await db.deleteFrom('todo_social_repost').where('uri', '=', uri.toString())
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
  db: PartialDB,
): DbRecordPlugin<Repost.Record, TodoSocialRepost> => {
  return {
    collection: type,
    tableName,
    validateSchema,
    translateDbObj,
    get: getFn(db),
    set: setFn(db),
    delete: deleteFn(db),
    notifsForRecord,
  }
}

export default makePlugin
