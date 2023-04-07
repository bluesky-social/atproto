import { PoolClient } from 'pg'
import Database from '.'

export class Leader {
  session: Session | null = null
  constructor(public id: number, public db: Database) {}

  async run<T>(
    task: (ctx: { signal: AbortSignal }) => Promise<T>,
  ): Promise<RunResult<T>> {
    const session = await this.lock()
    if (!session) return { ran: false }
    try {
      const result = await task({ signal: session.abortController.signal })
      return { ran: true, result }
    } finally {
      this.release()
    }
  }

  destroy(err?: Error) {
    this.session?.abortController.abort(err)
  }

  private async lock(): Promise<Session | null> {
    if (this.session) {
      return null
    }

    // Postgres implementation uses advisory locking, automatically released by ending connection.

    const client = await this.db.cfg.pool.connect()
    try {
      const lock = await client.query(
        'SELECT pg_try_advisory_lock($1) as acquired',
        [this.id],
      )
      if (!lock.rows[0].acquired) {
        client.release()
        return null
      }
    } catch (err) {
      client.release(true)
      throw err
    }

    const abortController = new AbortController()
    client.once('error', (err) => abortController.abort(err))
    this.session = { abortController, client }
    return this.session
  }

  private release() {
    // The flag ensures the connection is destroyed on release, not reused.
    // This is required, as that is how the pg advisory lock is released.
    this.session?.client.release(true)
    this.session = null
  }
}

type Session = { abortController: AbortController; client: PoolClient }

type RunResult<T> = { ran: false } | { ran: true; result: T }
