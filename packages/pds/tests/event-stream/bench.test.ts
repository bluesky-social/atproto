import { Database } from '../../src'
import SqlMessageQueue from '../../src/event-stream/message-queue'
import { Pool } from 'pg'
import { sql } from 'kysely'

const dbPostgresUrl = process.env.DB_POSTGRES_URL
const describePgOnly = dbPostgresUrl ? describe : describe.skip

describePgOnly('benchmark', () => {
  let pool: Pool
  let db: Database
  let messageQueue: SqlMessageQueue

  beforeAll(async () => {
    if (!dbPostgresUrl) throw new Error('Benchmarks are postgres-only')
    pool = new Pool({ connectionString: dbPostgresUrl, max: 10 })
    db = Database.postgres({
      pool,
      schema: 'event_stream_bench',
    })
    await db.migrateToLatestOrThrow()
  })

  afterAll(async () => {
    if (db) await db.close()
  })

  afterEach(async () => {
    if (messageQueue) {
      await messageQueue.destroy()
      await db.db.deleteFrom('message_queue').execute()
      await db.db.deleteFrom('message_queue_cursor').execute()
    }
  })

  it('when message queue gets backed-up, the db pool remains responsive.', async () => {
    messageQueue = new SqlMessageQueue('x', db)

    let processed = 0
    messageQueue.listen('event_a', {
      async listener() {
        await wait(5)
        processed++
      },
    })

    // 50 messages processed sequentially, each taking 5ms: should take over 250ms to complete.
    await Promise.all(
      [...Array(50)]
        .map(() => ({ type: 'event_a' }))
        .map((msg) => messageQueue.send(db, msg)),
    )

    const start = Date.now()
    await sql`select 1`.execute(db.db) // Should not be blocked by work on the queue
    expect(Date.now() - start).toBeLessThan(10)

    // Ensure all are processed
    await messageQueue.processingQueue?.onIdle()
    expect(processed).toEqual(50)
  })
})

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}
