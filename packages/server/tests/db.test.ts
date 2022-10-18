import { App } from '../src'
import * as locals from '../src/locals'
import { runTestServer, CloseFn } from './_util'

describe('db', () => {
  let close: CloseFn
  let app: App

  beforeAll(async () => {
    const server = await runTestServer({
      inviteRequired: true,
      dbPostgresSchema: 'db',
    })
    close = server.close
    app = server.app
  })

  afterAll(async () => {
    if (close) {
      await close()
    }
  })

  describe('transaction()', () => {
    it('commits changes', async () => {
      const { db } = locals.get(app)
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
      })
    })

    it('rolls-back changes on failure', async () => {
      const { db } = locals.get(app)
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

      expect(promise).rejects.toThrow('Oops!')

      const row = await db.db
        .selectFrom('repo_root')
        .selectAll()
        .where('did', '=', 'y')
        .executeTakeFirst()

      expect(row).toBeUndefined()
    })

    it('indicates isTransaction()', async () => {
      const { db } = locals.get(app)

      expect(db.db.isTransaction).toEqual(false)

      await db.transaction(async (dbTxn) => {
        expect(db.db.isTransaction).toEqual(false)
        expect(dbTxn.db.isTransaction).toEqual(true)
      })

      expect(db.db.isTransaction).toEqual(false)
    })
  })
})
