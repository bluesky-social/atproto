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

  const aliceDid = 'did:example:alice'
  const bobDid = 'did:example:bob'

  beforeAll(async () => {
    if (process.env.DB_POSTGRES_URL) {
      db = Database.postgres({
        url: process.env.DB_POSTGRES_URL,
        schema: 'migration_repo_sync_data',
      })
    } else {
      db = Database.memory()
    }
    await db.migrateToOrThrow('_20230127T215753149Z')
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
      repo = await repo.applyWrites(
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
      })
      creators.push({
        cid: entry.cid.toString(),
        did: aliceDid,
      })
      const registerTwice = Math.random() > 0.1
      if (registerTwice) {
        creators.push({
          cid: entry.cid.toString(),
          did: bobDid,
        })
      }
    }
    const rawDb: Kysely<any> = db.db
    await Promise.all([
      rawDb.insertInto('ipld_block').values(blocks).execute(),
      rawDb.insertInto('ipld_block_creator').values(creators).execute(),
      rawDb
        .insertInto('repo_root')
        .values([
          {
            did: aliceDid,
            root: repo.cid.toString(),
            indexedAt: new Date().toISOString(),
          },
          {
            did: bobDid,
            root: repo.cid.toString(),
            indexedAt: new Date().toISOString(),
          },
        ])
        .execute(),
    ])
  })

  it('migrates up', async () => {
    const migration = await db.migrator.migrateTo('_20230201T200606704Z')
    expect(migration.error).toBeUndefined()
  })

  it('fills in missing block creators', async () => {
    const aliceBlocks = await rawDb
      .selectFrom('ipld_block_creator')
      .selectAll()
      .where('did', '=', aliceDid)
      .execute()
    const bobBlocks = await rawDb
      .selectFrom('ipld_block_creator')
      .selectAll()
      .where('did', '=', bobDid)
      .execute()

    const aliceCids = aliceBlocks.map((row) => row.cid).sort()
    const bobCids = bobBlocks.map((row) => row.cid).sort()

    expect(aliceCids).toEqual(bobCids)
  })

  it('correctly constructs repo history', async () => {
    const checkRepoContents = async (did: string) => {
      const history = await rawDb
        .selectFrom('repo_commit_history')
        .where('creator', '=', did)
        .selectAll()
        .execute()
      const blocks = await rawDb
        .selectFrom('repo_commit_block')
        .where('creator', '=', did)
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
    }

    await checkRepoContents(aliceDid)
    await checkRepoContents(bobDid)
  })
})
