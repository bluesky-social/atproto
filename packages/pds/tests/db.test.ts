import { TestNetworkNoAppView } from '@atproto/dev-env'
// Importing from `dist` to circumvent circular dependency typing issues
import { AccountDb } from '../dist/account-manager/db'

describe('db', () => {
  let network: TestNetworkNoAppView
  let db: AccountDb

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'db',
    })
    db = network.pds.ctx.accountManager.db
  })

  afterAll(async () => {
    await network.close()
  })

  it('commits changes', async () => {
    const result = await db.transaction(async (dbTxn) => {
      return await dbTxn.db
        .insertInto('repo_root')
        .values({
          did: 'x',
          cid: 'x',
          rev: 'x',
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
      cid: 'x',
      rev: 'x',
      indexedAt: 'bad-date',
    })
  })

  it('rolls-back changes on failure', async () => {
    const promise = db.transaction(async (dbTxn) => {
      await dbTxn.db
        .insertInto('repo_root')
        .values({
          did: 'y',
          cid: 'y',
          rev: 'y',
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

  it('does not allow leaky transactions', async () => {
    let leakedTx: AccountDb | undefined

    const tx = db.transaction(async (dbTxn) => {
      leakedTx = dbTxn
      await dbTxn.db
        .insertInto('repo_root')
        .values({ cid: 'a', did: 'a', rev: 'a', indexedAt: 'bad-date' })
        .execute()
      throw new Error('test tx failed')
    })
    await expect(tx).rejects.toThrow('test tx failed')

    const attempt = leakedTx?.db
      .insertInto('repo_root')
      .values({ cid: 'b', did: 'b', rev: 'b', indexedAt: 'bad-date' })
      .execute()
    await expect(attempt).rejects.toThrow('tx already failed')

    const res = await db.db
      .selectFrom('repo_root')
      .selectAll()
      .where('did', 'in', ['a', 'b'])
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
            .insertInto('repo_root')
            .values({
              cid: name,
              did: name,
              rev: name,
              indexedAt: 'bad-date',
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
      .selectFrom('repo_root')
      .selectAll()
      .where('did', 'in', names)
      .execute()
    expect(res.length).toBe(0)
  })
})
