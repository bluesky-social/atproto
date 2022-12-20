import { Pool } from 'pg'
import { sql } from 'kysely'
import { Database } from '../../src'
import SqlMessageQueue from '../../src/event-stream/message-queue'

describe('event stream concurrency', () => {
  let db: Database
  let messageQueue: SqlMessageQueue
  let messageQueue2: SqlMessageQueue

  beforeAll(async () => {
    const dbPostgresUrl = process.env.DB_POSTGRES_URL
    db = dbPostgresUrl
      ? Database.postgres({
          pool: new Pool({ connectionString: dbPostgresUrl, max: 10 }),
          schema: 'event_stream_concurrency',
        })
      : Database.memory()
    await db.migrateToLatestOrThrow()
  })

  afterAll(async () => {
    if (db) await db.close()
  })

  afterEach(async () => {
    if (messageQueue) await messageQueue.destroy()
    if (messageQueue2) await messageQueue2.destroy()
    await db.db.deleteFrom('message_queue').execute()
    await db.db.deleteFrom('message_queue_cursor').execute()
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
    expect(Date.now() - start).toBeLessThan(20)

    // Ensure all messages are processed
    await queueIdle(messageQueue)
    expect(processed).toEqual(50)
  })

  it('processes topics in parallel.', async () => {
    messageQueue = new SqlMessageQueue('x', db)

    const processed = { a: 0, b: 0, c: 0, d: 0 }
    messageQueue.listen('event_a', {
      async listener(ctx) {
        await wait(5)
        if (ctx.message.type === 'event_a') {
          processed.a++
        }
      },
    })
    messageQueue.listen('event_b', {
      async listener(ctx) {
        await wait(5)
        if (ctx.message.type === 'event_b') {
          processed.b++
        }
      },
    })
    messageQueue.listen('event_c', {
      async listener(ctx) {
        await wait(5)
        if (ctx.message.type === 'event_c') {
          processed.c++
        }
      },
    })
    messageQueue.listen('event_d', {
      async listener(ctx) {
        await wait(5)
        if (ctx.message.type === 'event_d') {
          processed.d++
        }
      },
    })

    const eventTag = ['a', 'b', 'c', 'd']

    // 60 messages processed in 4 parallel topics, each taking 5ms: should take under 60 * 5 ms to complete
    await Promise.all(
      [...Array(60)]
        .map((_, i) => ({ type: `event_${eventTag[i % 4]}` }))
        .map((msg) => messageQueue.send(db, msg)),
    )

    const start = Date.now()
    await queueIdle(messageQueue)
    expect(processed).toEqual({ a: 15, b: 15, c: 15, d: 15 })
    if (db.dialect !== 'sqlite') {
      // sqlite serializes transactions, so we don't get the parallelism/speed-boost
      const duration = Date.now() - start
      expect(duration).toBeGreaterThan(15 * 5)
      expect(duration).toBeLessThan(60 * 5)
    }
  })

  it('processes *-topic and specific topics in tandem.', async () => {
    messageQueue = new SqlMessageQueue('x', db)
    messageQueue2 = new SqlMessageQueue('x', db)

    const processedById: { [s: string]: number } = {}
    const processedByType = { a: 0, b: 0 }
    const processedByQueue = { 1: 0, 2: 0 }
    const processedByTopic = { a: 0, b: 0, '*': 0 }

    messageQueue.listen('event_a', {
      async listener(ctx) {
        await wait(1)
        processedByType[ctx.message.tag as string]++
        processedByQueue[1]++
        processedByTopic.a++
        processedById[ctx.message.id as number] ??= 0
        processedById[ctx.message.id as number]++
      },
    })
    messageQueue.listen('*', {
      async listener(ctx) {
        await wait(1)
        processedByType[ctx.message.tag as string]++
        processedByQueue[1]++
        processedByTopic['*']++
        processedById[ctx.message.id as number] ??= 0
        processedById[ctx.message.id as number]++
      },
    })

    messageQueue2.listen('event_b', {
      async listener(ctx) {
        await wait(1)
        processedByType[ctx.message.tag as string]++
        processedByQueue[2]++
        processedByTopic.b++
        processedById[ctx.message.id as number] ??= 0
        processedById[ctx.message.id as number]++
      },
    })
    messageQueue2.listen('*', {
      async listener(ctx) {
        await wait(1)
        processedByType[ctx.message.tag as string]++
        processedByQueue[2]++
        processedByTopic['*']++
        processedById[ctx.message.id as number] ??= 0
        processedById[ctx.message.id as number]++
      },
    })

    const eventTag = ['a', 'b']

    for (let batch = 0; batch < 10; ++batch) {
      await Promise.all(
        [...Array(50)]
          .map((_, i) => ({
            type: `event_${eventTag[i % 2]}`,
            tag: eventTag[i % 2],
            id: batch * 50 + i,
          }))
          .map((msg, i) => {
            if ([0, 3].includes(i % 4)) {
              return messageQueue.send(db, msg)
            } else {
              return messageQueue2.send(db, msg)
            }
          }),
      )
      await Promise.all([queueIdle(messageQueue), queueIdle(messageQueue2)])
    }

    expect(Object.keys(processedById).length).toEqual(500)
    expect(processedByType.a).toEqual(250)
    expect(processedByType.b).toEqual(250)
    expect(processedByQueue[1] + processedByQueue[2]).toEqual(500)
    expect(
      processedByTopic.a + processedByTopic.b + processedByTopic['*'],
    ).toEqual(500)
  })
})

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

function queueIdle(queue: SqlMessageQueue) {
  const topicQueues = [...queue.topicQueues.values()]
  return Promise.all(topicQueues.map((tq) => tq.processingQueue?.onIdle()))
}
