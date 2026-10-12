import type { CompiledQuery } from 'kysely'
import { dbLogger } from '../logger.js'
import type { Database } from './index.js'

/** Cancels a read query when its HTTP request's signal aborts. */
export async function executeReadQuery<O>(
  db: Database,
  query: CompiledQuery<O>,
  signal: AbortSignal,
): Promise<O[]> {
  signal.throwIfAborted()
  try {
    return await db.db.connection().execute(
      async (connectionDb) => {
        signal.throwIfAborted()
        const connection = await connectionDb
          .getExecutor()
          .provideConnection(async (c) => c)
        if (!connection.collectSessionInfo || !connection.cancelQuery) {
          throw new Error('Read queries require PostgreSQL cancellation')
        }
        await connection.collectSessionInfo()
        signal.throwIfAborted()
        const cancelQuery = connection.cancelQuery.bind(connection)
        let cancellation: Promise<void> | undefined
        const onAbort = () => {
          cancellation = cancelQuery(async () => {
            throw new Error('A separate PostgreSQL control client is required')
          }).catch((err) => {
            dbLogger.warn({ err }, 'read query cancellation failed')
          })
        }
        signal.addEventListener('abort', onAbort, { once: true })
        try {
          // @NOTE no asynchronous gap between checking abort and sending SQL.
          signal.throwIfAborted()
          const result = await connection.executeQuery<O>(query)
          signal.throwIfAborted()
          return result.rows
        } finally {
          signal.removeEventListener('abort', onAbort)
          // @NOTE keep the backend reserved until cancellation settles.
          await cancellation
        }
      },
      { signal },
    )
  } catch (err) {
    signal.throwIfAborted()
    throw err
  }
}
