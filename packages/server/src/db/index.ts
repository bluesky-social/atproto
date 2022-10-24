import assert from 'assert'
import { Kysely, SqliteDialect, PostgresDialect, sql, Migrator } from 'kysely'
import SqliteDB from 'better-sqlite3'
import { Pool as PgPool, types as pgTypes } from 'pg'
import { ValidationResult, ValidationResultCode } from '@atproto/lexicon'
import { DbRecordPlugin, NotificationsPlugin } from './types'
import * as Badge from '../lexicon/types/app/bsky/badge'
import * as BadgeAccept from '../lexicon/types/app/bsky/badgeAccept'
import * as BadgeOffer from '../lexicon/types/app/bsky/badgeOffer'
import * as Follow from '../lexicon/types/app/bsky/follow'
import * as Like from '../lexicon/types/app/bsky/like'
import * as Post from '../lexicon/types/app/bsky/post'
import * as Profile from '../lexicon/types/app/bsky/profile'
import * as Repost from '../lexicon/types/app/bsky/repost'
import postPlugin, { AppBskyPost } from './records/post'
import likePlugin, { AppBskyLike } from './records/like'
import repostPlugin, { AppBskyRepost } from './records/repost'
import followPlugin, { AppBskyFollow } from './records/follow'
import badgePlugin, { AppBskyBadge } from './records/badge'
import badgeAcceptPlugin, { AppBskyBadgeAccept } from './records/badgeAccept'
import badgeOfferPlugin, { AppBskyBadgeOffer } from './records/badgeOffer'
import profilePlugin, { AppBskyProfile } from './records/profile'
import notificationPlugin from './tables/user-notification'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import { dbLogger as log } from '../logger'
import { DatabaseSchema } from './database-schema'
import * as scrypt from './scrypt'
import { User } from './tables/user'
import { dummyDialect } from './util'
import * as migrations from './migrations'
import { CtxMigrationProvider } from './migrations/provider'

export class Database {
  migrator: Migrator
  records: {
    post: DbRecordPlugin<Post.Record, AppBskyPost>
    like: DbRecordPlugin<Like.Record, AppBskyLike>
    repost: DbRecordPlugin<Repost.Record, AppBskyRepost>
    follow: DbRecordPlugin<Follow.Record, AppBskyFollow>
    profile: DbRecordPlugin<Profile.Record, AppBskyProfile>
    badge: DbRecordPlugin<Badge.Record, AppBskyBadge>
    badgeAccept: DbRecordPlugin<BadgeAccept.Record, AppBskyBadgeAccept>
    badgeOffer: DbRecordPlugin<BadgeOffer.Record, AppBskyBadgeOffer>
  }
  notifications: NotificationsPlugin

  constructor(
    public db: Kysely<DatabaseSchema>,
    public dialect: Dialect,
    public schema?: string,
  ) {
    this.records = {
      post: postPlugin(db),
      like: likePlugin(db),
      repost: repostPlugin(db),
      follow: followPlugin(db),
      badge: badgePlugin(db),
      badgeAccept: badgeAcceptPlugin(db),
      badgeOffer: badgeOfferPlugin(db),
      profile: profilePlugin(db),
    }
    this.notifications = notificationPlugin(db)
    this.migrator = new Migrator({
      db,
      migrationTableSchema: schema,
      provider: new CtxMigrationProvider(migrations, dialect),
    })
  }

  static sqlite(location: string): Database {
    const db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: new SqliteDB(location),
      }),
    })
    return new Database(db, 'sqlite')
  }

  static postgres(opts: { url: string; schema?: string }): Database {
    const { url, schema } = opts
    const pool = new PgPool({ connectionString: url })

    // Select count(*) and other pg bigints as js integer
    pgTypes.setTypeParser(pgTypes.builtins.INT8, (n) => parseInt(n, 10))

    // Setup schema usage, primarily for test parallelism (each test suite runs in its own pg schema)
    if (schema !== undefined) {
      if (!/^[a-z_]+$/i.test(schema)) {
        throw new Error(
          `Postgres schema must only contain [A-Za-z_]: ${schema}`,
        )
      }
      pool.on('connect', (client) =>
        // Shared objects such as extensions will go in the public schema
        client.query(`SET search_path TO "${schema}",public`),
      )
    }

    const db = new Kysely<DatabaseSchema>({
      dialect: new PostgresDialect({ pool }),
    })

    return new Database(db, 'pg', schema)
  }

  static memory(): Database {
    return Database.sqlite(':memory:')
  }

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    return await this.db.transaction().execute((txn) => {
      const dbTxn = new Database(txn, this.dialect, this.schema)
      return fn(dbTxn)
    })
  }

  get isTransaction() {
    return this.db.isTransaction
  }

  assertTransaction() {
    assert(this.isTransaction, 'Transaction required')
  }

  async close(): Promise<void> {
    await this.db.destroy()
  }

  async migrateToLatestOrThrow() {
    if (this.schema !== undefined) {
      await this.db.schema.createSchema(this.schema).ifNotExists().execute()
    }
    const { error, results } = await this.migrator.migrateToLatest()
    if (error) {
      throw error
    }
    if (!results) {
      throw new Error('An unknown failure occurred while migrating')
    }
    return results
  }

  async getRepoRoot(did: string, forUpdate?: boolean): Promise<CID | null> {
    let builder = this.db
      .selectFrom('repo_root')
      .selectAll()
      .where('did', '=', did)
    if (forUpdate) {
      this.assertTransaction()
      if (this.dialect !== 'sqlite') {
        // SELECT FOR UPDATE is not supported by sqlite, but sqlite txs are SERIALIZABLE so we don't actually need it
        builder = builder.forUpdate()
      }
    }
    const found = await builder.executeTakeFirst()
    return found ? CID.parse(found.root) : null
  }

  async updateRepoRoot(did: string, root: CID, prev?: CID): Promise<boolean> {
    log.debug({ did, root: root.toString() }, 'updating repo root')
    let builder = this.db
      .updateTable('repo_root')
      .set({ root: root.toString() })
      .where('did', '=', did)
    if (prev) {
      builder = builder.where('root', '=', prev.toString())
    }
    const res = await builder.executeTakeFirst()
    if (res.numUpdatedRows > 0) {
      log.info({ did, root: root.toString() }, 'updated repo root')
      return true
    } else {
      log.info(
        { did, root: root.toString() },
        'failed to update repo root: misordered',
      )
      return false
    }
  }

  async getUser(usernameOrDid: string): Promise<User | null> {
    let query = this.db.selectFrom('user').selectAll()
    if (usernameOrDid.startsWith('did:')) {
      query = query.where('did', '=', usernameOrDid)
    } else {
      query = query.where(
        sql`lower(username)`,
        '=',
        usernameOrDid.toLowerCase(),
      )
    }
    const found = await query.executeTakeFirst()
    return found || null
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const found = await this.db
      .selectFrom('user')
      .selectAll()
      .where(sql`lower(email)`, '=', email.toLowerCase())
      .executeTakeFirst()
    return found || null
  }

  async getUserDid(usernameOrDid: string): Promise<string | null> {
    if (usernameOrDid.startsWith('did:')) return usernameOrDid
    const found = await this.getUser(usernameOrDid)
    return found ? found.did : null
  }

  // Registration occurs in two steps:
  // - pre-registration, we setup the account with an invalid, temporary did which is only visible in a transaction.
  // - post-registration, we replace the temporary did with the user's newly-generated valid did.

  async preRegisterUser(
    email: string,
    username: string,
    tempDid: string,
    password: string,
  ) {
    this.assertTransaction()
    log.debug({ username, email, tempDid }, 'pre-registering user')
    const inserted = await this.db
      .insertInto('user')
      .values({
        email: email,
        username: username,
        did: tempDid,
        password: await scrypt.hash(password),
        createdAt: new Date().toISOString(),
        lastSeenNotifs: new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .returning('did')
      .executeTakeFirst()
    if (!inserted) {
      throw new UserAlreadyExistsError()
    }
    log.info({ username, email, tempDid }, 'pre-registered user')
  }

  async postRegisterUser(tempDid: string, did: string) {
    this.assertTransaction()
    log.debug({ tempDid, did }, 'post-registering user')
    const updated = await this.db
      .updateTable('user')
      .where('did', '=', tempDid)
      .set({ did })
      .executeTakeFirst()
    assert(
      Number(updated.numUpdatedRows) === 1,
      'Post-register should act on exactly one user',
    )
    log.info({ tempDid, did }, 'post-registered user')
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

  async indexRecord(uri: AtUri, cid: CID, obj: unknown) {
    this.assertTransaction()
    log.debug({ uri }, 'indexing record')
    const record = {
      uri: uri.toString(),
      cid: cid.toString(),
      did: uri.host,
      collection: uri.collection,
      rkey: uri.rkey,
      raw: JSON.stringify(obj),
      indexedAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    }
    if (!record.did.startsWith('did:')) {
      throw new Error('Expected indexed URI to contain DID')
    } else if (record.collection.length < 1) {
      throw new Error('Expected indexed URI to contain a collection')
    } else if (record.rkey.length < 1) {
      throw new Error('Expected indexed URI to contain a record key')
    }
    await this.db.insertInto('record').values(record).execute()
    const table = this.findTableForCollection(uri.collection)
    await table.insert(uri, cid, obj)
    const notifs = table.notifsForRecord(uri, cid, obj)
    await this.notifications.process(notifs)
    log.info({ uri }, 'indexed record')
  }

  async deleteRecord(uri: AtUri) {
    this.assertTransaction()
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
  ): Promise<{ uri: string; cid: string; value: object }[]> {
    let builder = this.db
      .selectFrom('record')
      .selectAll()
      .where('did', '=', did)
      .where('collection', '=', collection)
      .orderBy('rkey', reverse ? 'asc' : 'desc')
      .limit(limit)

    if (before !== undefined) {
      builder = builder.where('rkey', '<', before)
    }
    if (after !== undefined) {
      builder = builder.where('rkey', '>', after)
    }
    const res = await builder.execute()
    return res.map((row) => {
      return {
        uri: row.uri,
        cid: row.cid,
        value: JSON.parse(row.raw),
      }
    })
  }

  async getRecord(
    uri: AtUri,
    cid: string | null,
  ): Promise<{ uri: string; cid: string; value: object } | null> {
    let builder = this.db
      .selectFrom('record')
      .selectAll()
      .where('uri', '=', uri.toString())
    if (cid) {
      builder = builder.where('cid', '=', cid)
    }
    const record = await builder.executeTakeFirst()
    if (!record) return null
    return {
      uri: record.uri,
      cid: record.cid,
      value: JSON.parse(record.raw),
    }
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

export type Dialect = 'pg' | 'sqlite'

// Can use with typeof to get types for partial queries
export const dbType = new Kysely<DatabaseSchema>({ dialect: dummyDialect })

export class UserAlreadyExistsError extends Error {}
