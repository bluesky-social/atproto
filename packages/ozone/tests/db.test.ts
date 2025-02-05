import { sql } from 'kysely'
import { wait } from '@atproto/common'
import { TestNetwork } from '@atproto/dev-env'
import { Database } from '../src'

describe('db', () => {
  let network: TestNetwork
  let db: Database

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_db',
    })
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
            eventType: 'pds_takedown',
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
        eventType: 'pds_takedown',
        subjectDid: 'x',
      })
    })

    it('rolls-back changes on failure', async () => {
      const promise = db.transaction(async (dbTxn) => {
        await dbTxn.db
          .insertInto('repo_push_event')
          .values({
            eventType: 'pds_takedown',
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
          .values({ eventType: 'pds_takedown', subjectDid: 'a' })
          .execute()
        throw new Error('test tx failed')
      })
      await expect(tx).rejects.toThrow('test tx failed')

      const attempt = leakedTx?.db
        .insertInto('repo_push_event')
        .values({ eventType: 'pds_takedown', subjectDid: 'b' })
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
                eventType: 'pds_takedown',
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
})
