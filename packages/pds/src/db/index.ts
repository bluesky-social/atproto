import assert from 'assert'
import { Kysely, SqliteDialect, PostgresDialect, sql, Migrator } from 'kysely'
import SqliteDB from 'better-sqlite3'
import { Pool as PgPool, types as pgTypes } from 'pg'
import { ValidationResult, ValidationResultCode } from '@atproto/lexicon'
import { DbRecordPlugin, NotificationsPlugin } from './types'
import * as Declaration from '../lexicon/types/app/bsky/declaration'
import * as Invite from '../lexicon/types/app/bsky/invite'
import * as InviteAccept from '../lexicon/types/app/bsky/inviteAccept'
import * as Badge from '../lexicon/types/app/bsky/badge'
import * as BadgeAccept from '../lexicon/types/app/bsky/badgeAccept'
import * as BadgeOffer from '../lexicon/types/app/bsky/badgeOffer'
import * as Follow from '../lexicon/types/app/bsky/follow'
import * as Like from '../lexicon/types/app/bsky/like'
import * as Post from '../lexicon/types/app/bsky/post'
import * as Profile from '../lexicon/types/app/bsky/profile'
import * as Repost from '../lexicon/types/app/bsky/repost'
import declarationPlugin, { AppBskyDeclaration } from './records/declaration'
import postPlugin, { AppBskyPost } from './records/post'
import likePlugin, { AppBskyLike } from './records/like'
import repostPlugin, { AppBskyRepost } from './records/repost'
import followPlugin, { AppBskyFollow } from './records/follow'
import invitePlugin, { AppBskyInvite } from './records/invite'
import inviteAcceptPlugin, { AppBskyInviteAccept } from './records/inviteAccept'
import badgePlugin, { AppBskyBadge } from './records/badge'
import badgeAcceptPlugin, { AppBskyBadgeAccept } from './records/badgeAccept'
import badgeOfferPlugin, { AppBskyBadgeOffer } from './records/badgeOffer'
import profilePlugin, { AppBskyProfile } from './records/profile'
import notificationPlugin from './tables/user-notification'
import { AtUri } from '@atproto/uri'
import * as common from '@atproto/common'
import { CID } from 'multiformats/cid'
import { dbLogger as log } from '../logger'
import { DatabaseSchema } from './database-schema'
import * as scrypt from './scrypt'
import { User } from './tables/user'
import { dummyDialect } from './util'
import * as migrations from './migrations'
import { CtxMigrationProvider } from './migrations/provider'
import { UserDid } from './tables/user-did'

export class Database {
  migrator: Migrator
  records: {
    declaration: DbRecordPlugin<Declaration.Record, AppBskyDeclaration>
    post: DbRecordPlugin<Post.Record, AppBskyPost>
    like: DbRecordPlugin<Like.Record, AppBskyLike>
    repost: DbRecordPlugin<Repost.Record, AppBskyRepost>
    follow: DbRecordPlugin<Follow.Record, AppBskyFollow>
    profile: DbRecordPlugin<Profile.Record, AppBskyProfile>
    invite: DbRecordPlugin<Invite.Record, AppBskyInvite>
    inviteAccept: DbRecordPlugin<InviteAccept.Record, AppBskyInviteAccept>
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
      declaration: declarationPlugin(db),
      post: postPlugin(db),
      like: likePlugin(db),
      repost: repostPlugin(db),
      follow: followPlugin(db),
      invite: invitePlugin(db),
      inviteAccept: inviteAcceptPlugin(db),
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

  async updateRepoRoot(
    did: string,
    root: CID,
    prev: CID,
    timestamp?: string,
  ): Promise<boolean> {
    log.debug({ did, root: root.toString() }, 'updating repo root')
    const res = await this.db
      .updateTable('repo_root')
      .set({
        root: root.toString(),
        indexedAt: timestamp || new Date().toISOString(),
      })
      .where('did', '=', did)
      .where('root', '=', prev.toString())
      .executeTakeFirst()
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

  async getUser(usernameOrDid: string): Promise<(User & UserDid) | null> {
    let query = this.db
      .selectFrom('user')
      .innerJoin('user_did', 'user_did.username', 'user.username')
      .selectAll()
    if (usernameOrDid.startsWith('did:')) {
      query = query.where('did', '=', usernameOrDid)
    } else {
      query = query.where('user_did.username', '=', usernameOrDid.toLowerCase())
    }
    const found = await query.executeTakeFirst()
    return found || null
  }

  async getUserByEmail(email: string): Promise<(User & UserDid) | null> {
    const found = await this.db
      .selectFrom('user')
      .innerJoin('user_did', 'user_did.username', 'user.username')
      .selectAll()
      .where('email', '=', email.toLowerCase())
      .executeTakeFirst()
    return found || null
  }

  async getUserDid(usernameOrDid: string): Promise<string | null> {
    if (usernameOrDid.startsWith('did:')) return usernameOrDid
    const found = await this.getUser(usernameOrDid)
    return found ? found.did : null
  }

  async registerUser(email: string, username: string, password: string) {
    this.assertTransaction()
    log.debug({ username, email }, 'registering user')
    const inserted = await this.db
      .insertInto('user')
      .values({
        email: email,
        username: username,
        password: await scrypt.hash(password),
        createdAt: new Date().toISOString(),
        lastSeenNotifs: new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .returning('username')
      .executeTakeFirst()
    if (!inserted) {
      throw new UserAlreadyExistsError()
    }
    log.info({ username, email }, 'registered user')
  }

  async registerUserDid(username: string, did: string) {
    this.assertTransaction()
    log.debug({ username, did }, 'registering user did')
    await this.db
      .insertInto('user_did')
      .values({ username, did })
      .executeTakeFirst()
    log.info({ username, did }, 'post-registered user')
  }

  async updateUserPassword(username: string, password: string) {
    const hashedPassword = await scrypt.hash(password)
    await this.db
      .updateTable('user')
      .set({ password: hashedPassword })
      .where('username', '=', username)
      .execute()
  }

  async verifyUserPassword(
    username: string,
    password: string,
  ): Promise<boolean> {
    const found = await this.db
      .selectFrom('user')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst()
    if (!found) return false
    return scrypt.verify(password, found.password)
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

  async indexRecord(uri: AtUri, cid: CID, obj: unknown, timestamp?: string) {
    this.assertTransaction()
    log.debug({ uri }, 'indexing record')
    const record = {
      uri: uri.toString(),
      cid: cid.toString(),
      did: uri.host,
      collection: uri.collection,
      rkey: uri.rkey,
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
    await table.insert(uri, cid, obj, timestamp)
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
      .innerJoin('ipld_block', 'ipld_block.cid', 'record.cid')
      .where('record.did', '=', did)
      .where('record.collection', '=', collection)
      .orderBy('record.rkey', reverse ? 'asc' : 'desc')
      .limit(limit)
      .selectAll()

    if (before !== undefined) {
      builder = builder.where('record.rkey', '<', before)
    }
    if (after !== undefined) {
      builder = builder.where('record.rkey', '>', after)
    }
    const res = await builder.execute()
    return res.map((row) => {
      return {
        uri: row.uri,
        cid: row.cid,
        value: common.ipldBytesToRecord(row.content),
      }
    })
  }

  async getRecord(
    uri: AtUri,
    cid: string | null,
  ): Promise<{ uri: string; cid: string; value: object } | null> {
    let builder = this.db
      .selectFrom('record')
      .innerJoin('ipld_block', 'ipld_block.cid', 'record.cid')
      .selectAll()
      .where('record.uri', '=', uri.toString())
    if (cid) {
      builder = builder.where('record.cid', '=', cid)
    }
    const record = await builder.executeTakeFirst()
    if (!record) return null
    return {
      uri: record.uri,
      cid: record.cid,
      value: common.ipldBytesToRecord(record.content),
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
