import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type QueryExecutorProvider, sql } from 'kysely'
import { getAndMigrateRecoveryDb } from '../../scripts/sequencer-recovery/recovery-db.js'
import { getDb } from './index.js'

describe('sequencer db pragmas', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sequencer-db-'))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  const walAutoCheckpoint = async (db: { db: QueryExecutorProvider }) => {
    const { rows } = await sql<{
      wal_autocheckpoint: number
    }>`PRAGMA wal_autocheckpoint`.execute(db.db)
    return rows[0].wal_autocheckpoint
  }

  const open = {
    sequencer: async (location: string, disable: boolean) =>
      getDb(location, disable),
    recovery: async (location: string, disable: boolean) =>
      getAndMigrateRecoveryDb(location, disable),
  }

  for (const [name, getDatabase] of Object.entries(open)) {
    it(`${name} db disables wal autocheckpoint when asked`, async () => {
      const db = await getDatabase(path.join(dir, `${name}.sqlite`), true)
      try {
        expect(await walAutoCheckpoint(db)).toBe(0)
      } finally {
        await db.close()
      }
    })

    it(`${name} db keeps the default wal autocheckpoint otherwise`, async () => {
      const db = await getDatabase(path.join(dir, `${name}.sqlite`), false)
      try {
        expect(await walAutoCheckpoint(db)).toBe(1000)
      } finally {
        await db.close()
      }
    })
  }
})
