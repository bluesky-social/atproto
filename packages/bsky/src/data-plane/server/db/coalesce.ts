import { Transaction, sql } from 'kysely'
import { v3 as murmurV3 } from 'murmurhash'
import { DatabaseSchemaType } from './database-schema'

export async function coalesceWithLock(
  lockKey: string,
  txn: Transaction<DatabaseSchemaType>,
  fn: (txn: Transaction<DatabaseSchemaType>) => Promise<unknown>,
) {
  const runLockId = getLockId(`${lockKey}:run`)
  const waitLockId = getLockId(`${lockKey}:wait`)
  const runlocked = await tryAdvisoryLock(txn, runLockId)
  if (runlocked) {
    await fn(txn)
    return
  }
  const waitlocked = await tryAdvisoryLock(txn, waitLockId)
  if (waitlocked) {
    await acquireAdvisoryLock(txn, runLockId)
    await fn(txn)
  }
}

function getLockId(key: string) {
  return murmurV3(key)
}

/**
 * Try to acquire a transaction-level advisory lock (non-blocking)
 */
async function tryAdvisoryLock(
  txn: Transaction<DatabaseSchemaType>,
  lockId: number,
): Promise<boolean> {
  const result = await sql<{ locked: boolean }>`
    SELECT pg_try_advisory_xact_lock(${lockId}) as locked
  `.execute(txn)
  return result.rows[0].locked
}

/**
 * Acquire a transaction-level advisory lock (blocking)
 */
async function acquireAdvisoryLock(
  txn: Transaction<DatabaseSchemaType>,
  lockId: number,
): Promise<void> {
  await sql`SELECT pg_advisory_xact_lock(${lockId})`.execute(txn)
}
