import { Database } from '../../src'
import { MemoryBlockstore, Repo, WriteOpAction } from '@atproto/repo'
import { EcdsaKeypair, Keypair, randomStr } from '@atproto/crypto'
import { TID } from '@atproto/common'
import { Kysely } from 'kysely'
import { CID } from 'multiformats/cid'

describe('repo sync data migration', () => {
  let db: Database
  let rawDb: Kysely<any>
  let memoryStore: MemoryBlockstore
  let keypair: Keypair
  let repo: Repo

  beforeAll(async () => {
    if (process.env.DB_POSTGRES_URL) {
      db = Database.postgres({
        url: process.env.DB_POSTGRES_URL,
        schema: 'migration_duplicate_records',
      })
    } else {
      db = Database.memory()
    }
    await db.migrateToOrThrow('_20221230T215012029Z')
    rawDb = db.db
    memoryStore = new MemoryBlockstore()
    keypair = await EcdsaKeypair.create()
    repo = await Repo.create(memoryStore, keypair.did(), keypair)
  })

  afterAll(async () => {
    await db.close()
  })

  it('fills the db with some repo data', async () => {
    for (let i = 0; i < 100; i++) {
      repo = await repo.applyCommit(
        {
          action: WriteOpAction.Create,
          collection: randomStr(8, 'base32'),
          rkey: TID.nextStr(),
          record: { name: randomStr(32, 'base32') },
        },
        keypair,
      )
    }
    const blocks: any[] = []
    const creators: any[] = []
    for (const entry of memoryStore.blocks.entries()) {
      blocks.push({
        cid: entry.cid.toString(),
        size: entry.bytes.length,
        content: entry.bytes,
        indexedAt: new Date().toISOString(),
      })
      creators.push({
        cid: entry.cid.toString(),
        did: keypair.did(),
      })
    }
    const rawDb: Kysely<any> = db.db
    await Promise.all([
      rawDb.insertInto('ipld_block').values(blocks).execute(),
      rawDb.insertInto('ipld_block_creator').values(creators).execute(),
      rawDb
        .insertInto('repo_root')
        .values({
          did: keypair.did(),
          root: repo.cid.toString(),
          indexedAt: new Date().toISOString(),
        })
        .execute(),
    ])
  })

  it('migrates up', async () => {
    const migration = await db.migrator.migrateTo('_20230118T223059239Z')
    expect(migration.error).toBeUndefined()
  })

  it('correctly constructs repo history', async () => {
    const history = await rawDb
      .selectFrom('repo_commit_history')
      .selectAll()
      .execute()
    const blocks = await rawDb
      .selectFrom('repo_commit_block')
      .selectAll()
      .execute()
    const commits = await memoryStore.getCommits(repo.cid, null)
    if (!commits) {
      throw new Error('Could not get commit log from memoryStore')
    }
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i]
      const prev = commits[i - 1]?.commit?.toString() || null
      const filteredHistory = history.filter(
        (row) => row.commit === commit.commit.toString(),
      )
      expect(filteredHistory.length).toBe(1)
      expect(filteredHistory[0].prev).toEqual(prev)

      const filteredBlocks = blocks.filter(
        (row) => row.commit === commit.commit.toString(),
      )
      expect(filteredBlocks.length).toEqual(commit.blocks.size)
      filteredBlocks.forEach((block) => {
        expect(commit.blocks.has(CID.parse(block.block))).toBeTruthy()
      })
    }
  })
})
