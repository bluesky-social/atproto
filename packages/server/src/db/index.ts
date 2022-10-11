import { Kysely, SqliteDialect, sql } from 'kysely'
import SqliteDB from 'better-sqlite3'
import { ValidationResult, ValidationResultCode } from '@adxp/lexicon'
import { DbRecordPlugin, NotificationsPlugin } from './types'
import * as Badge from '../lexicon/types/todo/social/badge'
import * as Follow from '../lexicon/types/todo/social/follow'
import * as Like from '../lexicon/types/todo/social/like'
import * as Post from '../lexicon/types/todo/social/post'
import * as Profile from '../lexicon/types/todo/social/profile'
import * as Repost from '../lexicon/types/todo/social/repost'
import postPlugin, { TodoSocialPost } from './records/post'
import likePlugin, { TodoSocialLike } from './records/like'
import repostPlugin, { TodoSocialRepost } from './records/repost'
import followPlugin, { TodoSocialFollow } from './records/follow'
import badgePlugin, { TodoSocialBadge } from './records/badge'
import profilePlugin, { TodoSocialProfile } from './records/profile'
import notificationPlugin from './tables/user-notification'
import { AdxUri } from '@adxp/uri'
import { CID } from 'multiformats/cid'
import { dbLogger as log } from '../logger'
import { DatabaseSchema, createTables } from './database-schema'
import * as scrypt from './scrypt'
import { User } from './tables/user'
import { dummyDialect } from './util'

export class Database {
  db: Kysely<DatabaseSchema>
  records: {
    post: DbRecordPlugin<Post.Record, TodoSocialPost>
    like: DbRecordPlugin<Like.Record, TodoSocialLike>
    repost: DbRecordPlugin<Repost.Record, TodoSocialRepost>
    follow: DbRecordPlugin<Follow.Record, TodoSocialFollow>
    profile: DbRecordPlugin<Profile.Record, TodoSocialProfile>
    badge: DbRecordPlugin<Badge.Record, TodoSocialBadge>
  }
  notifications: NotificationsPlugin

  constructor(db: Kysely<DatabaseSchema>) {
    this.db = db
    this.records = {
      post: postPlugin(db),
      like: likePlugin(db),
      repost: repostPlugin(db),
      follow: followPlugin(db),
      badge: badgePlugin(db),
      profile: profilePlugin(db),
    }
    this.notifications = notificationPlugin(db)
  }

  static async sqlite(location: string): Promise<Database> {
    const db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: new SqliteDB(location),
      }),
    })
    return new Database(db)
  }

  static async memory(): Promise<Database> {
    return Database.sqlite(':memory:')
  }

  async close(): Promise<void> {
    await this.db.destroy()
  }

  async createTables(): Promise<void> {
    await createTables(this.db)
  }

  async getRepoRoot(did: string): Promise<CID | null> {
    const found = await this.db
      .selectFrom('repo_root')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()
    return found ? CID.parse(found.root) : null
  }

  async updateRepoRoot(did: string, root: CID) {
    log.debug({ did, root: root.toString() }, 'updating repo root')
    await this.db
      .updateTable('repo_root')
      .set({ root: root.toString() })
      .where('did', '=', did)
      .execute()
    log.info({ did, root: root.toString() }, 'updated repo root')
  }

  async getUser(usernameOrDid: string): Promise<User | null> {
    let query = this.db.selectFrom('user').selectAll()
    if (usernameOrDid.startsWith('did:')) {
      query = query.where('did', '=', usernameOrDid)
    } else {
      query = query.where(
        sql`UPPER(username)`,
        '=',
        usernameOrDid.toUpperCase(),
      )
    }
    const found = await query.executeTakeFirst()
    return found || null
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const found = await this.db
      .selectFrom('user')
      .selectAll()
      .where(sql`UPPER(email)`, '=', email.toUpperCase())
      .executeTakeFirst()
    return found || null
  }

  async getUserDid(usernameOrDid: string): Promise<string | null> {
    if (usernameOrDid.startsWith('did:')) return usernameOrDid
    const found = await this.getUser(usernameOrDid)
    return found ? found.did : null
  }

  async registerUser(
    email: string,
    username: string,
    did: string,
    password: string,
  ) {
    log.debug({ username, did, email }, 'registering user')
    const user = {
      email: email,
      username: username,
      did: did,
      password: await scrypt.hash(password),
      createdAt: new Date().toISOString(),
      lastSeenNotifs: new Date().toISOString(),
    }
    await this.db.insertInto('user').values(user).execute()
    log.info({ username, did, email }, 'registered user')
  }

  async updateUserPassword(did: string, password: string) {
    const hashedPassword = await scrypt.hash(password)
    await this.db
      .updateTable('user')
      .set({ password: hashedPassword })
      .where('did', '=', did)
      .execute()
  }

  async verifyUserPassword(
    username: string,
    password: string,
  ): Promise<string | null> {
    const found = await this.db
      .selectFrom('user')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst()
    if (!found) return null
    const validPass = await scrypt.verify(password, found.password)
    if (!validPass) return null
    return found.did
  }

  validateRecord(collection: string, obj: unknown): ValidationResult {
    let table
    try {
      table = this.findTableForCollection(collection)
    } catch (e) {
      const result = new ValidationResult()
      result._t(ValidationResultCode.Incompatible, `Schema not found`)
      return result
    }
    return table.validateSchema(obj)
  }

  canIndexRecord(collection: string, obj: unknown): boolean {
    const table = this.findTableForCollection(collection)
    return table.validateSchema(obj).valid
  }

  async indexRecord(uri: AdxUri, obj: unknown) {
    log.debug({ uri }, 'indexing record')
    const record = {
      uri: uri.toString(),
      did: uri.host,
      collection: uri.collection,
      recordKey: uri.recordKey,
      raw: JSON.stringify(obj),
      indexedAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    }
    if (!record.did.startsWith('did:')) {
      throw new Error('Expected indexed URI to contain DID')
    } else if (record.collection.length < 1) {
      throw new Error('Expected indexed URI to contain a collection')
    } else if (record.recordKey.length < 1) {
      throw new Error('Expected indexed URI to contain a record key')
    }
    await this.db.insertInto('record').values(record).execute()
    const table = this.findTableForCollection(uri.collection)
    await table.insert(uri, obj)
    const notifs = table.notifsForRecord(uri, obj)
    await this.notifications.process(notifs)
    log.info({ uri }, 'indexed record')
  }

  async deleteRecord(uri: AdxUri) {
    log.debug({ uri }, 'deleting indexed record')
    const table = this.findTableForCollection(uri.collection)
    const deleteQuery = this.db
      .deleteFrom('record')
      .where('uri', '=', uri.toString())
      .execute()
    await Promise.all([
      table.delete(uri),
      deleteQuery,
      this.notifications.deleteForRecord(uri),
    ])
    log.info({ uri }, 'deleted indexed record')
  }

  async listCollectionsForDid(did: string): Promise<string[]> {
    const collections = await this.db
      .selectFrom('record')
      .select('collection')
      .where('did', '=', did)
      .execute()

    return collections.map((row) => row.collection)
  }

  async listRecordsForCollection(
    did: string,
    collection: string,
    limit: number,
    reverse: boolean,
    before?: string,
    after?: string,
  ): Promise<{ uri: string; value: unknown }[]> {
    let builder = this.db
      .selectFrom('record')
      .selectAll()
      .where('did', '=', did)
      .where('collection', '=', collection)
      .orderBy('recordKey', reverse ? 'desc' : 'asc')
      .limit(limit)

    if (before !== undefined) {
      builder = builder.where('recordKey', '<', before)
    }
    if (after !== undefined) {
      builder = builder.where('recordKey', '>', after)
    }
    const res = await builder.execute()
    return res.map((row) => {
      return {
        uri: row.uri,
        value: JSON.parse(row.raw),
      }
    })
  }

  async getRecord(uri: AdxUri): Promise<unknown | null> {
    const record = await this.db
      .selectFrom('record')
      .select('raw')
      .where('uri', '=', uri.toString())
      .executeTakeFirst()
    return record ? JSON.parse(record.raw) : null
  }

  findTableForCollection(collection: string) {
    const found = Object.values(this.records).find(
      (plugin) => plugin.collection === collection,
    )
    if (!found) {
      throw new Error('Could not find table for collection')
    }
    return found
  }
}

export default Database

// Can use with typeof to get types for partial queries
export const dbType = new Kysely<DatabaseSchema>({ dialect: dummyDialect })
