import { sql } from 'kysely'
import { type AccountDb, getDb, getMigrator } from '../index.js'

type Col = [
  name: string,
  type: string,
  notnull: 0 | 1,
  dflt: string | null,
  pk: number,
]
type Idx = { name: string; unique: 0 | 1; columns: string[] }

const readTable = async (db: AccountDb, table: string) => {
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
  space_notification_retry: {
    cols: [
      ['repo', 'varchar', 1, null, 1],
      ['space', 'varchar', 1, null, 2],
      ['repoRev', 'varchar', 1, null, 0],
      ['data', 'BLOB', 1, null, 0],
      ['attempts', 'INTEGER', 1, null, 0],
      ['retryAt', 'INTEGER', 1, null, 0],
      ['expiresAt', 'INTEGER', 1, null, 0],
    ],
    indexes: [
      {
        name: 'space_notification_retry_at_idx',
        unique: 0,
        columns: ['retryAt'],
      },
    ],
  },
  space_notification_lease: {
    cols: [
      ['id', 'INTEGER', 0, null, 1],
      ['owner', 'varchar', 1, null, 0],
      ['expiresAt', 'INTEGER', 1, null, 0],
    ],
    indexes: [],
  },
  revoked_space_credential: {
    cols: [
      ['space', 'varchar', 1, null, 1],
      ['jti', 'varchar', 1, null, 2],
      ['expiresAt', 'varchar', 1, null, 0],
    ],
    indexes: [
      {
        name: 'revoked_space_credential_expires_at_idx',
        unique: 0,
        columns: ['expiresAt'],
      },
    ],
  },
  space_syncer_notification_retry: {
    cols: [
      ['space', 'varchar', 1, null, 1],
      ['endpoint', 'varchar', 1, null, 2],
      ['token', 'varchar', 1, null, 3],
      ['noticeJson', 'varchar', 1, null, 0],
      ['attempts', 'INTEGER', 1, null, 0],
      ['retryAt', 'INTEGER', 1, null, 0],
      ['expiresAt', 'INTEGER', 1, null, 0],
    ],
    indexes: [
      {
        name: 'space_syncer_notification_retry_at_idx',
        unique: 0,
        columns: ['retryAt'],
      },
    ],
  },
}

describe('account migrations', () => {
  it('creates the final spaces account schema with the lease seed row', async () => {
    const db = getDb(':memory:')
    try {
      await getMigrator(db).migrateToLatestOrThrow()
      for (const [table, want] of Object.entries(expected)) {
        expect({ table, ...(await readTable(db, table)) }).toEqual({
          table,
          ...want,
        })
      }
      const lease = await sql`select * from space_notification_lease`.execute(
        db.db,
      )
      expect(lease.rows).toEqual([{ id: 1, owner: '', expiresAt: 0 }])
    } finally {
      await db.close()
    }
  })
})
