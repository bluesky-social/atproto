import { sql } from 'kysely'
import { once } from 'events'
import { wait } from '@atproto/common'
import { Database } from '../src'
import { Leader, appMigration } from '../src/db/leader'
import { runTestServer, CloseFn } from './_util'

describe('db', () => {
  let close: CloseFn
  let db: Database

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'db',
    })
    close = server.close
    db = server.ctx.db
  })

  afterAll(async () => {
    if (close) {
      await close()
    }
  })

  describe('transaction()', () => {
    it('commits changes', async () => {
      const result = await db.transaction(async (dbTxn) => {
        return await dbTxn.db
          .insertInto('repo_root')
          .values({
            did: 'x',
            root: 'x',
            indexedAt: 'bad-date',
          })
          .returning('did')
          .executeTakeFirst()
      })

      if (!result) {
        return expect(result).toBeTruthy()
      }

      expect(result.did).toEqual('x')

      const row = await db.db
        .selectFrom('repo_root')
        .selectAll()
        .where('did', '=', 'x')
        .executeTakeFirst()

      expect(row).toEqual({
        did: 'x',
        root: 'x',
        indexedAt: 'bad-date',
        takedownId: null,
      })
    })

    it('rolls-back changes on failure', async () => {
      const promise = db.transaction(async (dbTxn) => {
        await dbTxn.db
          .insertInto('repo_root')
          .values({
            did: 'y',
            root: 'y',
            indexedAt: 'bad-date',
          })
          .returning('did')
          .executeTakeFirst()

        throw new Error('Oops!')
      })

      await expect(promise).rejects.toThrow('Oops!')

      const row = await db.db
        .selectFrom('repo_root')
        .selectAll()
        .where('did', '=', 'y')
        .executeTakeFirst()

      expect(row).toBeUndefined()
    })

    it('indicates isTransaction', async () => {
      expect(db.isTransaction).toEqual(false)

      await db.transaction(async (dbTxn) => {
        expect(db.isTransaction).toEqual(false)
        expect(dbTxn.isTransaction).toEqual(true)
      })

      expect(db.isTransaction).toEqual(false)
    })

    it('asserts transaction', async () => {
      expect(() => db.assertTransaction()).toThrow('Transaction required')

      await db.transaction(async (dbTxn) => {
        expect(() => dbTxn.assertTransaction()).not.toThrow()
      })
    })
  })

  describe('Leader', () => {
    it('allows leaders to run sequentially.', async () => {
      const task = async () => {
        await wait(25)
        return 'complete'
      }
      const leader1 = new Leader(777, db)
      const leader2 = new Leader(777, db)
      const leader3 = new Leader(777, db)
      const result1 = await leader1.run(task)
      await wait(1) // Short grace period for pg to close session
      const result2 = await leader2.run(task)
      await wait(1)
      const result3 = await leader3.run(task)
      await wait(1)
      const result4 = await leader3.run(task)
      expect([result1, result2, result3, result4]).toEqual([
        { ran: true, result: 'complete' },
        { ran: true, result: 'complete' },
        { ran: true, result: 'complete' },
        { ran: true, result: 'complete' },
      ])
    })

    it('only allows one leader at a time.', async () => {
      await wait(1)
      const task = async () => {
        await wait(25)
        return 'complete'
      }
      const results = await Promise.all([
        new Leader(777, db).run(task),
        new Leader(777, db).run(task),
        new Leader(777, db).run(task),
      ])
      const byRan = (a, b) => Number(a.ran) - Number(b.ran)
      expect(results.sort(byRan)).toEqual([
        { ran: false },
        { ran: false },
        { ran: true, result: 'complete' },
      ])
    })

    it('leaders with different ids do not conflict.', async () => {
      await wait(1)
      const task = async () => {
        await wait(25)
        return 'complete'
      }
      const results = await Promise.all([
        new Leader(777, db).run(task),
        new Leader(778, db).run(task),
        new Leader(779, db).run(task),
      ])
      expect(results).toEqual([
        { ran: true, result: 'complete' },
        { ran: true, result: 'complete' },
        { ran: true, result: 'complete' },
      ])
    })

    it('supports abort.', async () => {
      const task = async (ctx: { signal: AbortSignal }) => {
        wait(10).then(abort)
        return await Promise.race([
          wait(50),
          once(ctx.signal, 'abort').then(() => ctx.signal.reason),
        ])
      }
      const leader = new Leader(777, db)
      const abort = () => {
        leader.session?.abortController.abort(new Error('Oops!'))
      }
      const result = await leader.run(task)
      expect(result).toEqual({ ran: true, result: new Error('Oops!') })
    })
  })

  describe('appMigration()', () => {
    it('fails once together', async () => {
      if (db.cfg.dialect !== 'pg') return // postgres-only

      await db.db.deleteFrom('did_handle').execute()
      await db.db
        .insertInto('did_handle')
        .values([
          {
            did: 'did:plc:1',
            handle: 'user1',
          },
          {
            did: 'did:plc:2',
            handle: 'user2',
          },
        ])
        .execute()

      let runCount = 0
      const migration = async (tx: Database) => {
        const nthRun = runCount++
        await wait(100)
        await tx.db.deleteFrom('did_handle').execute()
        await wait(100)
        if (nthRun === 0) throw new Error('Intentional failure')
      }

      const results = await Promise.allSettled([
        appMigration(db, 'migration-fail', migration),
        appMigration(db, 'migration-fail', migration),
        appMigration(db, 'migration-fail', migration),
        appMigration(db, 'migration-fail', migration),
        appMigration(db, 'migration-fail', migration),
        appMigration(db, 'migration-fail', migration),
        appMigration(db, 'migration-fail', migration),
        appMigration(db, 'migration-fail', migration),
      ])

      const errMessages = results
        .map((res) => res['reason']?.['message'] ?? null)
        .sort()

      expect(runCount).toEqual(1)
      expect(errMessages).toEqual([
        'Intentional failure',
        'Migration previously failed',
        'Migration previously failed',
        'Migration previously failed',
        'Migration previously failed',
        'Migration previously failed',
        'Migration previously failed',
        'Migration previously failed',
      ])

      const after = await db.db
        .selectFrom('did_handle')
        .select(sql<number>`count(*)`.as('count'))
        .executeTakeFirstOrThrow()
      expect(after.count).toEqual(2)
    })

    it('succeeds once together', async () => {
      if (db.cfg.dialect !== 'pg') return // postgres-only

      await db.db.deleteFrom('did_handle').execute()

      let runCount = 0
      const migration = async (tx: Database) => {
        const nthRun = runCount++
        await wait(100)
        await tx.db
          .insertInto('did_handle')
          .values({
            did: `did:plc:${nthRun}`,
            handle: `user${nthRun}`,
          })
          .execute()
        await wait(100)
      }

      const results = await Promise.allSettled([
        appMigration(db, 'migration-succeed', migration),
        appMigration(db, 'migration-succeed', migration),
        appMigration(db, 'migration-succeed', migration),
        appMigration(db, 'migration-succeed', migration),
        appMigration(db, 'migration-succeed', migration),
        appMigration(db, 'migration-succeed', migration),
        appMigration(db, 'migration-succeed', migration),
        appMigration(db, 'migration-succeed', migration),
      ])

      const statuses = results.map((res) => res.status)

      expect(runCount).toEqual(1)
      expect(statuses).toEqual([
        'fulfilled',
        'fulfilled',
        'fulfilled',
        'fulfilled',
        'fulfilled',
        'fulfilled',
        'fulfilled',
        'fulfilled',
      ])

      const after = await db.db.selectFrom('did_handle').select('did').execute()
      expect(after).toEqual([{ did: 'did:plc:0' }])
    })
  })
})
