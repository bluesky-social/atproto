import { once } from 'events'
import { wait } from '@atproto/common'
import { Database } from '../src'
import { Leader } from '../src/db/leader'
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
          .insertInto('actor')
          .values({
            did: 'x',
            handle: 'x',
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
        .selectFrom('actor')
        .selectAll()
        .where('did', '=', 'x')
        .executeTakeFirst()

      expect(row).toEqual({
        did: 'x',
        handle: 'x',
        indexedAt: 'bad-date',
        takedownId: null,
      })
    })

    it('rolls-back changes on failure', async () => {
      const promise = db.transaction(async (dbTxn) => {
        await dbTxn.db
          .insertInto('actor')
          .values({
            did: 'y',
            handle: 'y',
            indexedAt: 'bad-date',
          })
          .returning('did')
          .executeTakeFirst()

        throw new Error('Oops!')
      })

      await expect(promise).rejects.toThrow('Oops!')

      const row = await db.db
        .selectFrom('actor')
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
