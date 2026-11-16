import { sql } from 'kysely'
import { type ActorDb, getDb, getMigrator } from '../index.js'

type Col = [
  name: string,
  type: string,
  notnull: 0 | 1,
  dflt: string | null,
  pk: number,
]
type Idx = { name: string; unique: 0 | 1; columns: string[] }

const readTable = async (db: ActorDb, table: string) => {
  const cols = await sql<{
    name: string
    type: string
    notnull: number
    dflt_value: string | null
    pk: number
  }>`select name, type, "notnull", dflt_value, pk from pragma_table_info(${table}) order by cid`.execute(
    db.db,
  )
  const idxList = await sql<{ name: string; unique: number; origin: string }>`
    select name, "unique", origin from pragma_index_list(${table}) where origin = 'c' order by name
  `.execute(db.db)
  const indexes: Idx[] = []
  for (const idx of idxList.rows) {
    const info = await sql<{ name: string }>`
      select name from pragma_index_info(${idx.name}) order by seqno
    `.execute(db.db)
    indexes.push({
      name: idx.name,
      unique: idx.unique as 0 | 1,
      columns: info.rows.map((r) => r.name),
    })
  }
  return {
    cols: cols.rows.map((c): Col => [
      c.name,
      c.type,
      c.notnull as 0 | 1,
      c.dflt_value,
      c.pk,
    ]),
    indexes,
  }
}

const expected: Record<string, { cols: Col[]; indexes: Idx[] }> = {
  space: {
    cols: [
      ['uri', 'varchar', 0, null, 1],
      ['authority', 'varchar', 1, null, 0],
      ['type', 'varchar', 1, null, 0],
      ['createdAt', 'varchar', 1, null, 0],
      ['deletedAt', 'varchar', 0, null, 0],
    ],
    indexes: [],
  },
  memberspace_member: {
    cols: [
      ['space', 'varchar', 1, null, 1],
      ['did', 'varchar', 1, null, 2],
      ['read', 'INTEGER', 1, '1', 0],
      ['write', 'INTEGER', 1, '1', 0],
    ],
    indexes: [],
  },
  space_policy: {
    cols: [
      ['uri', 'varchar', 0, null, 1],
      ['policyJson', 'TEXT', 1, null, 0],
    ],
    indexes: [],
  },
  space_record: {
    cols: [
      ['uri', 'varchar', 0, null, 1],
      ['space', 'varchar', 1, null, 0],
      ['collection', 'varchar', 1, null, 0],
      ['rkey', 'varchar', 1, null, 0],
      ['cid', 'varchar', 1, null, 0],
      ['value', 'BLOB', 1, null, 0],
      ['repoRev', 'varchar', 1, null, 0],
      ['indexedAt', 'varchar', 1, null, 0],
    ],
    indexes: [
      {
        name: 'space_record_path_idx',
        unique: 1,
        columns: ['space', 'collection', 'rkey'],
      },
      {
        name: 'space_record_rev_idx',
        unique: 0,
        columns: ['space', 'repoRev'],
      },
    ],
  },
  space_record_blob: {
    cols: [
      ['blobCid', 'varchar', 1, null, 1],
      ['recordUri', 'varchar', 1, null, 2],
    ],
    indexes: [
      {
        name: 'space_record_blob_record_idx',
        unique: 0,
        columns: ['recordUri'],
      },
    ],
  },
  space_repo: {
    cols: [
      ['space', 'varchar', 0, null, 1],
      ['setHash', 'BLOB', 0, null, 0],
      ['rev', 'varchar', 0, null, 0],
    ],
    indexes: [],
  },
  space_record_oplog: {
    cols: [
      ['space', 'varchar', 1, null, 1],
      ['rev', 'varchar', 1, null, 2],
      ['idx', 'INTEGER', 1, null, 3],
      ['action', 'varchar', 1, null, 0],
      ['uri', 'varchar', 1, null, 0],
      ['collection', 'varchar', 1, null, 0],
      ['rkey', 'varchar', 1, null, 0],
      ['cid', 'varchar', 0, null, 0],
      ['prev', 'varchar', 0, null, 0],
    ],
    indexes: [],
  },
  space_writer: {
    cols: [
      ['space', 'varchar', 1, null, 1],
      ['did', 'varchar', 1, null, 2],
      ['repoRev', 'varchar', 1, null, 0],
      ['data', 'BLOB', 1, null, 0],
      ['spaceRev', 'varchar', 1, null, 0],
      ['removedAt', 'varchar', 0, null, 0],
    ],
    indexes: [
      {
        name: 'space_writer_space_rev_idx',
        unique: 0,
        columns: ['space', 'spaceRev'],
      },
    ],
  },
  space_notify_registration: {
    cols: [
      ['space', 'varchar', 1, null, 1],
      ['endpoint', 'varchar', 1, null, 2],
      ['token', 'varchar', 1, null, 3],
      ['expiresAt', 'varchar', 1, null, 0],
      ['expiryNotified', 'INTEGER', 1, '0', 0],
    ],
    indexes: [],
  },
}

describe('actor-store migrations', () => {
  it('creates the final spaces actor-store schema', async () => {
    const db = getDb(':memory:')
    try {
      await getMigrator(db).migrateToLatestOrThrow()
      for (const [table, want] of Object.entries(expected)) {
        expect({ table, ...(await readTable(db, table)) }).toEqual({
          table,
          ...want,
        })
      }
    } finally {
      await db.close()
    }
  })
})
