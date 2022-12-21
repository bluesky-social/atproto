import { cidForData } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { Database } from '../src'
import SqlBlockstore from '../src/sql-blockstore'
import { CloseFn, runTestServer } from './_util'

describe('sql blockstore', () => {
  let db: Database
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'sql_blockstore',
    })
    close = server.close
    db = server.ctx.db
  })

  afterAll(async () => {
    await close()
  })

  it('does recursive commit history', async () => {
    const commits: CID[] = []
    for (let i = 0; i < 10; i++) {
      const cid = await cidForData(`commit-${i}`)
      commits.push(cid)
      await db.db
        .insertInto('repo_commit_history')
        .values({
          commit: cid.toString(),
          prev: commits[i - 1]?.toString() || null,
        })
        .execute()
    }

    // const from = commits[3].toString()
    const from = null
    const to = commits[6].toString()

    const res = await db.db
      .withRecursive('ancestor(commit, prev)', (cte) =>
        cte
          .selectFrom('repo_commit_history as commit')
          .select(['commit.commit as commit', 'commit.prev as prev'])
          .where('commit', '=', to)
          .unionAll(
            cte
              .selectFrom('repo_commit_history as commit')
              .select(['commit.commit as commit', 'commit.prev as prev'])
              .innerJoin('ancestor', 'ancestor.prev', 'commit.commit')
              .if(from !== null, (qb) =>
                // @ts-ignore
                qb.where('commit.commit', '!=', from as string),
              ),
          ),
      )
      .selectFrom('ancestor')
      .select('commit')
      .execute()

    console.log(res)
    console.log(commits)
  })

  // it('puts and gets blocks.', async () => {
  //   const did = 'did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme'

  //   const cid = await db.transaction(async (dbTxn) => {
  //     const blockstore = new SqlBlockstore(dbTxn, did)
  //     const cid = await blockstore.stage({ my: 'block' })
  //     const commitCid = await blockstore.stage({ my: 'commit' })
  //     await blockstore.saveStaged(commitCid)
  //     return cid
  //   })

  //   const blockstore = new SqlBlockstore(db, did)
  //   const value = await blockstore.getUnchecked(cid)

  //   expect(value).toEqual({ my: 'block' })
  // })

  // it('allows same content to be put multiple times by the same did.', async () => {
  //   const did = 'did:key:zQ3shtxV1FrJfhqE1dvxYRcCknWNjHc3c5X1y3ZSoPDi2aur2'

  //   const cidA = await db.transaction(async (dbTxn) => {
  //     const blockstore = new SqlBlockstore(dbTxn, did)
  //     const cid = await blockstore.stage({ my: 'block' })
  //     const commitCid = await blockstore.stage({ my: 'commit1' })
  //     await blockstore.saveStaged(commitCid)
  //     return cid
  //   })

  //   const cidB = await db.transaction(async (dbTxn) => {
  //     const blockstore = new SqlBlockstore(dbTxn, did)
  //     const cid = await blockstore.stage({ my: 'block' })
  //     const commitCid = await blockstore.stage({ my: 'commit2' })
  //     await blockstore.saveStaged(commitCid)
  //     return cid
  //   })

  //   expect(cidA.equals(cidB)).toBe(true)
  // })
})
