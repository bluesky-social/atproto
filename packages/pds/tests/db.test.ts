import { Database } from '../src'
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
})
