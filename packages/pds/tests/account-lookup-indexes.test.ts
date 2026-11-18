import SqliteDB from 'better-sqlite3'
import { type CompiledQuery, Kysely, SqliteDialect } from 'kysely'
import {
  type AccountDb,
  type DatabaseSchema,
  getMigrator,
} from '../src/account-manager/db/index.js'
import * as accountHelper from '../src/account-manager/helpers/account.js'
import { Database } from '../src/db/index.js'

// Handles and emails are indexed only as lower("handle") and lower("email"), so
// a lookup that compares the bare column scans the whole table: fine with a few
// accounts, seconds of blocked event loop with a million.
describe('account lookups use the handle and email indexes', () => {
  let sqlite: SqliteDB.Database
  let db: AccountDb
  let queries: CompiledQuery[]

  const plan = (q: CompiledQuery): string[] =>
    sqlite
      .prepare(`EXPLAIN QUERY PLAN ${q.sql}`)
      .all(...(q.parameters as unknown[]))
      .map((row) => (row as { detail: string }).detail)

  const expectNoTableScan = (q: CompiledQuery) => {
    const scans = plan(q).filter((d) => /^SCAN (actor|account)\b/.test(d))
    expect({ sql: q.sql, scans }).toEqual({ sql: q.sql, scans: [] })
  }

  beforeAll(async () => {
    sqlite = new SqliteDB(':memory:')
    db = new Database(
      new Kysely<DatabaseSchema>({
        dialect: new SqliteDialect({ database: sqlite }),
        log: (event) => {
          if (event.level === 'query') queries.push(event.query)
        },
      }),
    )
    queries = []
    await getMigrator(db).migrateToLatestOrThrow()
    for (const name of ['alice', 'bob']) {
      const did = `did:example:${name}` as const
      await accountHelper.registerActor(db, {
        did,
        handle: `${name}.test` as const,
      })
      await accountHelper.registerAccount(db, {
        did,
        email: `${name}@test.com`,
        passwordScrypt: 'unused',
      })
    }
  })

  beforeEach(() => {
    queries = []
  })

  afterAll(async () => {
    await db.close()
  })

  it('getAccount by handle', async () => {
    const found = await accountHelper.getAccount(db, 'Alice.Test')
    expect(found?.did).toBe('did:example:alice')
    expect(queries).toHaveLength(1)
    queries.forEach(expectNoTableScan)
  })

  it('getAccountByEmail', async () => {
    const found = await accountHelper.getAccountByEmail(db, 'Bob@Test.com')
    expect(found?.did).toBe('did:example:bob')
    expect(queries).toHaveLength(1)
    queries.forEach(expectNoTableScan)
  })

  it("updateHandle's check that the handle is free", async () => {
    await expect(
      accountHelper.updateHandle(db, 'did:example:alice', 'bob.test'),
    ).rejects.toThrow(accountHelper.UserAlreadyExistsError)
    expect(queries).toHaveLength(1)
    queries.forEach(expectNoTableScan)
  })
})
