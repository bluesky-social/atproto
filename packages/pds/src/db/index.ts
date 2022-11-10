import assert from 'assert'
import { Kysely, SqliteDialect, PostgresDialect, Migrator } from 'kysely'
import SqliteDB from 'better-sqlite3'
import { Pool as PgPool, types as pgTypes } from 'pg'
import { ValidationResult, ValidationResultCode } from '@atproto/lexicon'
import * as Declaration from './records/declaration'
import * as Post from './records/post'
import * as Vote from './records/vote'
import * as Repost from './records/repost'
import * as Trend from './records/trend'
import * as Follow from './records/follow'
import * as Assertion from './records/assertion'
import * as Confirmation from './records/confirmation'
import * as Profile from './records/profile'
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
import { DidHandle } from './tables/did-handle'
import { Record as DeclarationRecord } from '../lexicon/types/app/bsky/system/declaration'
import { APP_BSKY_GRAPH } from '../lexicon'
import { MessageQueue } from './types'

export class Database {
  migrator: Migrator
  records: {
    declaration: Declaration.PluginType
    post: Post.PluginType
    vote: Vote.PluginType
    repost: Repost.PluginType
    trend: Trend.PluginType
    follow: Follow.PluginType
    profile: Profile.PluginType
    assertion: Assertion.PluginType
    confirmation: Confirmation.PluginType
  }

  constructor(
    public db: Kysely<DatabaseSchema>,
    public dialect: Dialect,
    public schema?: string,
    public messageQueue?: MessageQueue,
  ) {
    this.records = {
      declaration: Declaration.makePlugin(db),
      post: Post.makePlugin(db),
      vote: Vote.makePlugin(db),
      repost: Repost.makePlugin(db),
      trend: Trend.makePlugin(db),
      follow: Follow.makePlugin(db),
      assertion: Assertion.makePlugin(db),
      confirmation: Confirmation.makePlugin(db),
      profile: Profile.makePlugin(db),
    }
    // this.notifications = notificationPlugin(db)
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
      const dbTxn = new Database(
        txn,
        this.dialect,
        this.schema,
        this.messageQueue,
      )
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

  setMessageQueue(mq: MessageQueue) {
    this.messageQueue = mq
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

  async getUser(handleOrDid: string): Promise<(User & DidHandle) | null> {
    let query = this.db
      .selectFrom('user')
      .innerJoin('did_handle', 'did_handle.handle', 'user.handle')
      .selectAll()
    if (handleOrDid.startsWith('did:')) {
      query = query.where('did', '=', handleOrDid)
    } else {
      query = query.where('did_handle.handle', '=', handleOrDid.toLowerCase())
    }
    const found = await query.executeTakeFirst()
    return found || null
  }

  async getUserByEmail(email: string): Promise<(User & DidHandle) | null> {
    const found = await this.db
      .selectFrom('user')
      .innerJoin('did_handle', 'did_handle.handle', 'user.handle')
      .selectAll()
      .where('email', '=', email.toLowerCase())
      .executeTakeFirst()
    return found || null
  }

  async getDidForActor(handleOrDid: string): Promise<string | null> {
    if (handleOrDid.startsWith('did:')) return handleOrDid
    const found = await this.db
      .selectFrom('did_handle')
      .where('handle', '=', handleOrDid)
      .select('did')
      .executeTakeFirst()
    return found ? found.did : null
  }

  async registerUser(email: string, handle: string, password: string) {
    this.assertTransaction()
    log.debug({ handle, email }, 'registering user')
    const inserted = await this.db
      .insertInto('user')
      .values({
        email: email.toLowerCase(),
        handle: handle,
        password: await scrypt.hash(password),
        createdAt: new Date().toISOString(),
        lastSeenNotifs: new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .returning('handle')
      .executeTakeFirst()
    if (!inserted) {
      throw new UserAlreadyExistsError()
    }
    log.info({ handle, email }, 'registered user')
  }

  async preregisterDid(handle: string, tempDid: string) {
    this.assertTransaction()
    const inserted = await this.db
      .insertInto('did_handle')
      .values({
        handle,
        did: tempDid,
        actorType: 'temp',
        declarationCid: 'temp',
      })
      .onConflict((oc) => oc.doNothing())
      .returning('handle')
      .executeTakeFirst()
    if (!inserted) {
      throw new UserAlreadyExistsError()
    }
    log.info({ handle, tempDid }, 'pre-registered did')
  }

  async finalizeDid(
    handle: string,
    did: string,
    tempDid: string,
    declaration: DeclarationRecord,
  ) {
    this.assertTransaction()
    log.debug({ handle, did }, 'registering did-handle')
    const declarationCid = await common.cidForData(declaration)
    const updated = await this.db
      .updateTable('did_handle')
      .set({
        did,
        actorType: declaration.actorType,
        declarationCid: declarationCid.toString(),
      })
      .where('handle', '=', handle)
      .where('did', '=', tempDid)
      .returningAll()
      .executeTakeFirst()
    if (!updated) {
      throw new Error('DID could not be finalized')
    }
    log.info({ handle, did }, 'post-registered did-handle')
  }

  async updateUserPassword(handle: string, password: string) {
    const hashedPassword = await scrypt.hash(password)
    await this.db
      .updateTable('user')
      .set({ password: hashedPassword })
      .where('handle', '=', handle)
      .execute()
  }

  async verifyUserPassword(handle: string, password: string): Promise<boolean> {
    const found = await this.db
      .selectFrom('user')
      .selectAll()
      .where('handle', '=', handle)
      .executeTakeFirst()
    if (!found) return false
    return scrypt.verify(password, found.password)
  }

  async isUserControlledRepo(
    repoDid: string,
    userDid: string | null,
  ): Promise<boolean> {
    if (!userDid) return false
    if (repoDid === userDid) return true
    const found = await this.db
      .selectFrom('did_handle')
      .leftJoin('scene', 'scene.handle', 'did_handle.handle')
      .where('did_handle.did', '=', repoDid)
      .where('scene.owner', '=', userDid)
      .select('scene.owner')
      .executeTakeFirst()
    return !!found
  }

  async getScenesForUser(userDid: string): Promise<string[]> {
    const res = await this.db
      .selectFrom('assertion')
      .where('assertion.subjectDid', '=', userDid)
      .where('assertion.assertion', '=', APP_BSKY_GRAPH.AssertMember)
      .where('assertion.confirmUri', 'is not', null)
      .select('assertion.creator as scene')
      .execute()
    return res.map((row) => row.scene)
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
    const events = await table.insert(uri, cid, obj, timestamp)
    this.messageQueue && (await this.messageQueue.send(this, events))

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

    const [events, _] = await Promise.all([table.delete(uri), deleteQuery])
    this.messageQueue && (await this.messageQueue.send(this, events))

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
