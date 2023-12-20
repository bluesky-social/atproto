import { once } from 'events'
import { sql } from 'kysely'
import { wait } from '@atproto/common'
import { TestNetwork } from '@atproto/dev-env'
import { Database } from '../src'
import { Leader } from '../src/db/leader'
import assert from 'assert'

describe('db', () => {
  let network: TestNetwork
  let db: Database

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_db',
      ozone: { enabled: true },
    })
    assert(network.ozone)
    db = network.ozone.ctx.db
  })

  afterAll(async () => {
    await network.close()
  })

  it('handles client errors without crashing.', async () => {
    const tryKillConnection = db.transaction(async (dbTxn) => {
      const result = await sql`select pg_backend_pid() as pid;`.execute(
        dbTxn.db,
      )
      const pid = result.rows[0]?.['pid'] as number
      await sql`select pg_terminate_backend(${pid});`.execute(db.db)
      await sql`select 1;`.execute(dbTxn.db)
    })
    // This should throw, but no unhandled error
    await expect(tryKillConnection).rejects.toThrow()
  })

  it('handles pool errors without crashing.', async () => {
    const conn1 = await db.pool.connect()
    const conn2 = await db.pool.connect()
    const result = await conn1.query('select pg_backend_pid() as pid;')
    const conn1pid: number = result.rows[0].pid
    conn1.release()
    await wait(100) // let release apply, conn is now idle on pool.
    await conn2.query(`select pg_terminate_backend(${conn1pid});`)
    conn2.release()
  })

  describe('transaction()', () => {
    it('commits changes', async () => {
      const result = await db.transaction(async (dbTxn) => {
        return await dbTxn.db
          .insertInto('repo_push_event')
          .values({
            eventType: 'takedown',
            subjectDid: 'x',
          })
          .returning('subjectDid')
          .executeTakeFirst()
      })

      if (!result) {
        return expect(result).toBeTruthy()
      }

      expect(result.subjectDid).toEqual('x')

      const row = await db.db
        .selectFrom('repo_push_event')
        .selectAll()
        .where('subjectDid', '=', 'x')
        .executeTakeFirst()

      expect(row).toMatchObject({
        eventType: 'takedown',
        subjectDid: 'x',
      })
    })

    it('rolls-back changes on failure', async () => {
      const promise = db.transaction(async (dbTxn) => {
        await dbTxn.db
          .insertInto('repo_push_event')
          .values({
            eventType: 'takedown',
            subjectDid: 'y',
          })
          .returning('subjectDid')
          .executeTakeFirst()

        throw new Error('Oops!')
      })

      await expect(promise).rejects.toThrow('Oops!')

      const row = await db.db
        .selectFrom('repo_push_event')
        .selectAll()
        .where('subjectDid', '=', 'y')
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

    it('does not allow leaky transactions', async () => {
      let leakedTx: Database | undefined

      const tx = db.transaction(async (dbTxn) => {
        leakedTx = dbTxn
        await dbTxn.db
          .insertInto('repo_push_event')
          .values({ eventType: 'takedown', subjectDid: 'a' })
          .execute()
        throw new Error('test tx failed')
      })
      await expect(tx).rejects.toThrow('test tx failed')

      const attempt = leakedTx?.db
        .insertInto('repo_push_event')
        .values({ eventType: 'takedown', subjectDid: 'b' })
        .execute()
      await expect(attempt).rejects.toThrow('tx already failed')

      const res = await db.db
        .selectFrom('repo_push_event')
        .selectAll()
        .where('subjectDid', 'in', ['a', 'b'])
        .execute()

      expect(res.length).toBe(0)
    })

    it('ensures all inflight queries are rolled back', async () => {
      let promise: Promise<unknown> | undefined = undefined
      const names: string[] = []
      try {
        await db.transaction(async (dbTxn) => {
          const queries: Promise<unknown>[] = []
          for (let i = 0; i < 20; i++) {
            const name = `user${i}`
            const query = dbTxn.db
              .insertInto('repo_push_event')
              .values({
                eventType: 'takedown',
                subjectDid: name,
              })
              .execute()
            names.push(name)
            queries.push(query)
          }
          promise = Promise.allSettled(queries)
          throw new Error()
        })
      } catch (err) {
        expect(err).toBeDefined()
      }
      if (promise) {
        await promise
      }

      const res = await db.db
        .selectFrom('repo_push_event')
        .selectAll()
        .where('subjectDid', 'in', names)
        .execute()
      expect(res.length).toBe(0)
    })
  })

  describe('Leader', () => {
    it('allows leaders to run sequentially.', async () => {
      const task = async () => {
        await wait(25)
        return 'complete'
      }
      const leader1 = new Leader(707, db)
      const leader2 = new Leader(707, db)
      const leader3 = new Leader(707, db)
      const result1 = await leader1.run(task)
      await wait(5) // Short grace period for pg to close session
      const result2 = await leader2.run(task)
      await wait(5)
      const result3 = await leader3.run(task)
      await wait(5)
      const result4 = await leader3.run(task)
      expect([result1, result2, result3, result4]).toEqual([
        { ran: true, result: 'complete' },
        { ran: true, result: 'complete' },
        { ran: true, result: 'complete' },
        { ran: true, result: 'complete' },
      ])
    })

    it('only allows one leader at a time.', async () => {
      const task = async () => {
        await wait(75)
        return 'complete'
      }
      const results = await Promise.all([
        new Leader(717, db).run(task),
        new Leader(717, db).run(task),
        new Leader(717, db).run(task),
      ])
      const byRan = (a, b) => Number(a.ran) - Number(b.ran)
      expect(results.sort(byRan)).toEqual([
        { ran: false },
        { ran: false },
        { ran: true, result: 'complete' },
      ])
    })

    it('leaders with different ids do not conflict.', async () => {
      const task = async () => {
        await wait(75)
        return 'complete'
      }
      const results = await Promise.all([
        new Leader(727, db).run(task),
        new Leader(728, db).run(task),
        new Leader(729, db).run(task),
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
      const leader = new Leader(737, db)
      const abort = () => {
        leader.session?.abortController.abort(new Error('Oops!'))
      }
      const result = await leader.run(task)
      expect(result).toEqual({ ran: true, result: new Error('Oops!') })
    })
  })
})
