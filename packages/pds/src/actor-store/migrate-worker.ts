// Worker entry point: opens an actor sqlite store, runs the kysely migrator
// to latest, then exits. Spawned by migrateInWorker() in this file.
//
// better-sqlite3 is synchronous and pegs the event loop for the duration of
// any single query. Migrations can include statements that take seconds
// (e.g. CREATE INDEX on a large table, or a recursive CTE), so we offload
// the migration to its own worker thread to keep the main loop responsive.
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from 'node:worker_threads'
import { Migrator } from '../db'
import { getDb } from './db'
import {
  getAllMigrations,
  getExtraMigrations,
  setExtraMigration,
} from './db/migrations'

type WorkerInput = {
  dbLocation: string
  disableWalAutoCheckpoint: boolean
  // Test-only: raw-SQL migrations to register inside the worker before
  // running the migrator. Forwarded automatically from the main thread's
  // registry (see ./db/migrations.setExtraMigration).
  extraMigrations: Record<string, { upSql: string; downSql?: string }>
}

type WorkerResult =
  | { ok: true }
  | { ok: false; message: string; stack?: string }

export const migrateInWorker = (
  input: Pick<WorkerInput, 'dbLocation' | 'disableWalAutoCheckpoint'>,
): Promise<void> => {
  const data: WorkerInput = {
    ...input,
    extraMigrations: getExtraMigrations(),
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: data })
    let result: WorkerResult | undefined
    worker.on('message', (msg: WorkerResult) => {
      result = msg
    })
    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (!result) {
        return reject(
          new Error(
            `actor store migrate worker exited (code ${code}) without reporting`,
          ),
        )
      }
      if (result.ok) return resolve()
      const err = new Error(result.message)
      if (result.stack) err.stack = result.stack
      reject(err)
    })
  })
}

if (!isMainThread && parentPort) {
  const port = parentPort
  const run = async () => {
    const { dbLocation, disableWalAutoCheckpoint, extraMigrations } =
      workerData as WorkerInput
    // Re-register the extras inside this isolate so getAllMigrations() (and
    // thus the migrator) sees them.
    for (const [name, { upSql, downSql }] of Object.entries(extraMigrations)) {
      setExtraMigration(name, upSql, downSql)
    }
    const db = getDb(dbLocation, disableWalAutoCheckpoint)
    try {
      const migrator = new Migrator(db.db, getAllMigrations())
      await migrator.migrateToLatestOrThrow()
    } finally {
      db.close()
    }
  }
  run().then(
    () => port.postMessage({ ok: true } satisfies WorkerResult),
    (err: Error) =>
      port.postMessage({
        ok: false,
        message: err?.message ?? String(err),
        stack: err?.stack,
      } satisfies WorkerResult),
  )
}
