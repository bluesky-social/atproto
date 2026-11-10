import SqliteDB from 'better-sqlite3'
import { type CompiledQuery, Kysely, SqliteDialect } from 'kysely'
import type { DidString, HandleString } from '@atproto/lex'
import { Database } from '../../db/index.js'
import {
  type AccountDb,
  type DatabaseSchema,
  getMigrator,
} from '../db/index.js'
import * as account from './account.js'

/**
 * The account db is shared by every request on a PDS. The only indexes on
 * `actor.handle` and `account.email` are the unique `lower(...)` expression
 * indexes, which sqlite can only use when the query compares `lower(column)`.
 * A plain `handle = ?` or `email = ?` scans the whole table: on the order of
 * 30ms per lookup at 500k accounts, and in `updateHandle()` that scan runs
 * while holding the account db write lock.
 *
 * These tests capture the SQL that the helpers actually execute and assert on
 * sqlite's query plan for it.
 */
describe('account lookups', () => {
  let raw: SqliteDB.Database
  let db: AccountDb
  let executed: CompiledQuery[] = []

  const alice = {
    did: 'did:plc:alice00000000000000000000' as DidString,
    handle: 'alice.test' as HandleString,
    email: 'alice@test.com',
  }
  const bob = {
    did: 'did:plc:bob0000000000000000000000' as DidString,
    handle: 'bob.test' as HandleString,
    email: 'bob@test.com',
  }
  // Rows written before handles and emails were normalized on write can hold
  // capitals. The unique lower() indexes already treat them as taken.
  const legacy = {
    did: 'did:plc:legacy000000000000000000' as DidString,
    handle: 'Legacy.Test' as HandleString,
    email: 'Legacy@Test.com',
  }

  const plan = (query: CompiledQuery): string[] =>
    raw
      .prepare<unknown[], { detail: string }>(`EXPLAIN QUERY PLAN ${query.sql}`)
      .all(...query.parameters)
      .map((row) => row.detail)

  const planOf = async (fn: () => Promise<unknown>): Promise<string[]> => {
    executed = []
    await fn().catch(() => {})
    expect(executed).toHaveLength(1)
    return plan(executed[0])
  }

  beforeAll(async () => {
    raw = new SqliteDB(':memory:')
    db = new Database<DatabaseSchema>(
      new Kysely<DatabaseSchema>({
        dialect: new SqliteDialect({ database: raw }),
        log: (event) => {
          if (event.level === 'query') executed.push(event.query)
        },
      }),
    )
    await getMigrator(db).migrateToLatestOrThrow()

    for (const { did, handle, email } of [alice, bob]) {
      await account.registerActor(db, { did, handle })
      await account.registerAccount(db, { did, email, passwordScrypt: 's' })
    }
    await db.db
      .insertInto('actor')
      .values({ did: legacy.did, handle: legacy.handle, createdAt: 'x' })
      .execute()
    await db.db
      .insertInto('account')
      .values({ did: legacy.did, email: legacy.email, passwordScrypt: 's' })
      .execute()
  })

  afterAll(async () => {
    await db?.close()
  })

  describe('query plans', () => {
    it('getAccount() by handle uses the handle index', async () => {
      const steps = await planOf(() => account.getAccount(db, alice.handle))
      expect(steps).not.toContainEqual(expect.stringMatching(/^SCAN /))
      expect(steps).toContainEqual(
        expect.stringContaining('actor_handle_lower_idx'),
      )
    })

    it('getAccountByEmail() uses the email index', async () => {
      const steps = await planOf(() =>
        account.getAccountByEmail(db, alice.email),
      )
      expect(steps).not.toContainEqual(expect.stringMatching(/^SCAN /))
      expect(steps).toContainEqual(
        expect.stringContaining('account_email_lower_idx'),
      )
    })

    it("updateHandle()'s uniqueness check uses the handle index", async () => {
      const steps = await planOf(() =>
        account.updateHandle(db, alice.did, 'alice2.test' as HandleString),
      )
      expect(steps).not.toContainEqual(expect.stringMatching(/^SCAN /))
      expect(steps).toContainEqual(
        expect.stringContaining('actor_handle_lower_idx'),
      )
    })
  })

  describe('results', () => {
    it('finds accounts by handle and email', async () => {
      await expect(account.getAccount(db, bob.handle)).resolves.toMatchObject({
        did: bob.did,
      })
      await expect(
        account.getAccountByEmail(db, bob.email),
      ).resolves.toMatchObject({ did: bob.did })
      await expect(
        account.getAccount(db, 'nobody.test' as HandleString),
      ).resolves.toBeNull()
      await expect(
        account.getAccountByEmail(db, 'nobody@test.com'),
      ).resolves.toBeNull()
    })

    it('finds legacy rows stored with capitals', async () => {
      await expect(
        account.getAccount(db, 'legacy.test' as HandleString),
      ).resolves.toMatchObject({ did: legacy.did })
      await expect(
        account.getAccountByEmail(db, 'legacy@test.com'),
      ).resolves.toMatchObject({ did: legacy.did })
    })

    it('refuses a handle taken by another account in different case', async () => {
      await expect(
        account.updateHandle(db, bob.did, 'legacy.test' as HandleString),
      ).rejects.toThrow(account.UserAlreadyExistsError)
    })
  })
})
