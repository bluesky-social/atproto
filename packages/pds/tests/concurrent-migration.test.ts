import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { getDb, getMigrator } from '../src/account-manager/db'

describe('concurrent account db migration', () => {
  it('two connections migrating the same db simultaneously should both succeed', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pds-migration-test-'))
    const dbPath = path.join(tmpDir, 'account.sqlite')

    try {
      const db1 = getDb(dbPath)
      const db2 = getDb(dbPath)

      try {
        await db1.ensureWal()
        await db2.ensureWal()

        // Run migrations concurrently from two separate connections,
        // simulating two PDS processes starting up at the same time.
        await Promise.all([
          getMigrator(db1).migrateToLatestOrThrow(),
          getMigrator(db2).migrateToLatestOrThrow(),
        ])
      } finally {
        db1.close()
        db2.close()
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
