import { Kysely } from 'kysely'
import { CID } from 'multiformats/cid'
import { chunkArray } from '@atproto/common'
import { BlockMap, MST, ReadableBlockstore, def } from '@atproto/repo'

class MigrationBlockstore extends ReadableBlockstore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: Kysely<any>
  constructor(db: Kysely<unknown>) {
    super()
    this.db = db as Kysely<any>
  }

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    const res = await this.db
      .selectFrom('repo_block')
      .where('cid', '=', cid.toString())
      .select('content')
      .executeTakeFirst()
    return res?.content ?? null
  }

  async has(cid: CID): Promise<boolean> {
    const bytes = await this.getBytes(cid)
    return bytes !== null
  }

  async getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }> {
    const blocks = new BlockMap()
    const missing: CID[] = []
    for (const batch of chunkArray(cids, 500)) {
      const cidStrings = batch.map((c) => c.toString())
      const res = await this.db
        .selectFrom('repo_block')
        .where('cid', 'in', cidStrings)
        .select(['cid', 'content'])
        .execute()
      const found = new Set<string>()
      for (const row of res) {
        const cid = CID.parse(row.cid)
        blocks.set(cid, row.content)
        found.add(row.cid)
      }
      for (const c of batch) {
        if (!found.has(c.toString())) {
          missing.push(c)
        }
      }
    }
    return { blocks, missing }
  }
}

type PreorderRow = { lpath: string; depth: number; cid: string }

const BATCH_SIZE = 500

class BatchInserter {
  private buf: PreorderRow[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: Kysely<any>
  constructor(db: Kysely<unknown>) {
    this.db = db as Kysely<any>
  }

  async add(row: PreorderRow): Promise<void> {
    this.buf.push(row)
    if (this.buf.length >= BATCH_SIZE) {
      await this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.buf.length === 0) return
    await this.db.insertInto('preorder_map').values(this.buf).execute()
    this.buf = []
  }
}

async function preorderTraverse(
  node: MST,
  lpath: string,
  layer: number,
  inserter: BatchInserter,
): Promise<void> {
  await inserter.add({
    lpath,
    depth: 129 - layer,
    cid: (await node.getPointer()).toString(),
  })

  const entries = await node.getEntries()
  let currentLpath = lpath
  for (const entry of entries) {
    if (entry.isLeaf()) {
      await inserter.add({
        lpath: entry.key,
        depth: 0,
        cid: entry.value.toString(),
      })
      currentLpath = entry.key
    } else {
      const childLayer = (await entry.getLayer()) ?? layer - 1
      await preorderTraverse(entry, currentLpath, childLayer, inserter)
    }
  }
}

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('preorder_map')
    .addColumn('lpath', 'varchar', (col) => col.notNull())
    .addColumn('depth', 'integer', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('preorder_map_pkey', ['lpath', 'depth'])
    .execute()

  // Populate the table from the existing MST
  const anyDb = db as Kysely<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const root = await anyDb
    .selectFrom('repo_root')
    .select('cid')
    .limit(1)
    .executeTakeFirst()
  if (!root) return

  const storage = new MigrationBlockstore(db)
  const commitCid = CID.parse(root.cid)
  const commit = await storage.readObj(commitCid, def.versionedCommit)
  const mst = MST.load(storage, commit.data)
  const layer = await mst.getLayer()

  const inserter = new BatchInserter(db)
  await preorderTraverse(mst, '', layer, inserter)
  await inserter.flush()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('preorder_map').execute()
}
