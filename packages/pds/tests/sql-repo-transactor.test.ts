import crypto from 'node:crypto'
import { cidForRawHash } from '@atproto/lex-data'
import { BlockMap } from '@atproto/repo'
import {
  type ActorDb,
  getDb,
  getMigrator,
} from '../src/actor-store/db/index.js'
import { SqlRepoTransactor } from '../src/actor-store/repo/sql-repo-transactor.js'

describe('SqlRepoTransactor', () => {
  let db: ActorDb

  beforeAll(async () => {
    db = getDb(':memory:')
    await getMigrator(db).migrateToLatestOrThrow()
  })

  afterAll(async () => {
    await db?.close()
  })

  it('deletes more blocks than SQLite allows bound variables per statement', async () => {
    // SQLite caps a statement at 32,766 bound variables
    const count = 40_000
    const blocks = new BlockMap()
    for (let i = 0; i < count; i++) {
      const bytes = new TextEncoder().encode(`block-${i}`)
      const digest = crypto.createHash('sha256').update(bytes).digest()
      blocks.set(cidForRawHash(digest), bytes)
    }

    const storage = new SqlRepoTransactor(db, 'did:example:alice')
    await storage.putMany(blocks, 'rev1')
    await storage.deleteMany(blocks.cids())

    const { total } = await db.db
      .selectFrom('repo_block')
      .select((eb) => eb.fn.countAll<number>().as('total'))
      .executeTakeFirstOrThrow()
    expect(total).toBe(0)
  }, 30_000)
})
