import { jest } from '@jest/globals'
import { sql } from 'kysely'
import { wait } from '@atproto/common'
import { TestNetwork } from '@atproto/dev-env'
import { Database } from '../src/db/index.js'
import { executeReadQuery } from '../src/db/read-query.js'
import { tools } from '../src/lexicons/index.js'

describe('moderation query cancellation', () => {
  let network: TestNetwork
  let db: Database

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_query_cancellation',
    })
    db = new Database({
      ...network.ozone.ctx.db.opts,
      pool: undefined,
      poolSize: 1,
    })
  })

  afterAll(async () => {
    await db?.close()
    await network?.close()
  })

  async function queryIsActive(pattern: string) {
    const { rows } = await sql<{ active: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE pid <> pg_backend_pid() AND state = 'active'
          AND query LIKE ${pattern}
      ) AS active
    `.execute(network.ozone.ctx.db.db)
    return rows[0].active
  }

  async function until(check: () => Promise<boolean>) {
    const deadline = performance.now() + 2000
    while (!(await check())) {
      if (performance.now() >= deadline) throw new Error('Condition timed out')
      await wait(10)
    }
  }

  it('cancels server work with the only pool connection occupied', async () => {
    const controller = new AbortController()
    const reason = new Error('Client disconnected')
    const pattern = '%read_query_disconnect%'
    const result = executeReadQuery(
      db,
      sql`SELECT pg_sleep(10) /* read_query_disconnect */`.compile(db.db),
      controller.signal,
    ).catch((err) => err)
    try {
      await until(() => queryIsActive(pattern))
      const started = performance.now()
      controller.abort(reason)
      expect(await result).toBe(reason)
      expect(performance.now() - started).toBeLessThan(2000)
      expect(await queryIsActive(pattern)).toBe(false)
      const { rows } = await sql<{ value: number }>`SELECT 1 AS value`.execute(
        db.db,
      )
      expect(rows[0].value).toBe(1)
    } finally {
      controller.abort()
      await result
    }
  })

  it('keeps the connection reserved if cancellation fails', async () => {
    const connection = await db.db
      .getExecutor()
      .provideConnection(async (c) => c)
    using cancel = jest
      .spyOn(connection, 'cancelQuery')
      .mockRejectedValue(new Error('Control connection unavailable'))
    const controller = new AbortController()
    const reason = new Error('Disconnected')
    const result = executeReadQuery(
      db,
      sql`SELECT pg_sleep(0.2) /* read_query_cancel_failure */`.compile(db.db),
      controller.signal,
    ).catch((err) => err)
    try {
      await until(() => queryIsActive('%read_query_cancel_failure%'))
      controller.abort(reason)
      await until(async () => cancel.mock.calls.length > 0)
      expect(db.pool.idleCount).toBe(0)
      expect(await result).toBe(reason)
      expect(cancel).toHaveBeenCalled()
    } finally {
      controller.abort()
      await result
    }
    expect(await queryIsActive('%read_query_cancel_failure%')).toBe(false)
  })

  it('preserves statement_timeout during and after the query', async () => {
    const setting = () =>
      sql<{ timeout: string; pid: number }>`
      SELECT current_setting('statement_timeout') AS timeout, pg_backend_pid() AS pid
    `.execute(db.db)
    const before = (await setting()).rows[0]
    expect(
      await executeReadQuery(
        db,
        sql<{ value: number; timeout: string }>`
          SELECT 42 AS value, current_setting('statement_timeout') AS timeout
          FROM pg_sleep(0.1)
        `.compile(db.db),
        new AbortController().signal,
      ),
    ).toEqual([{ value: 42, timeout: before.timeout }])
    expect((await setting()).rows[0]).toEqual(before)
    await expect(
      executeReadQuery(
        db,
        sql`SELECT 1 / 0`.compile(db.db),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: '22012' })
    expect((await setting()).rows[0]).toEqual(before)
  })

  it('does not acquire a connection for an already aborted request', async () => {
    const controller = new AbortController()
    controller.abort(new Error('Already disconnected'))
    using connect = jest.spyOn(db.pool, 'connect')
    await expect(
      executeReadQuery(
        db,
        sql`SELECT pg_sleep(10)`.compile(db.db),
        controller.signal,
      ),
    ).rejects.toBe(controller.signal.reason)
    expect(connect).not.toHaveBeenCalled()
  })

  it('does not submit listing SQL after aborting an initializing connection', async () => {
    const freshDb = new Database({ ...db.opts, pool: undefined, poolSize: 1 })
    await sql`CREATE SEQUENCE read_query_during_setup`.execute(db.db)
    // @NOTE delay pool setup to make a disconnect during initialization observable.
    freshDb.pool.on('connect', (client) => {
      void client
        .query('SELECT pg_sleep(0.2) /* read_query_initializing */')
        .catch(() => undefined)
    })
    const controller = new AbortController()
    const result = executeReadQuery(
      freshDb,
      sql`SELECT nextval('read_query_during_setup')`.compile(freshDb.db),
      controller.signal,
    ).catch((err) => err)
    try {
      await until(() => queryIsActive('%read_query_initializing%'))
      controller.abort(new Error('Disconnected during setup'))
      expect(await result).toBe(controller.signal.reason)
      // @NOTE wait for any late checkout to be released before checking the sentinel.
      await sql`SELECT 1`.execute(freshDb.db)
      const { rows } = await sql<{ is_called: boolean }>`
        SELECT is_called FROM read_query_during_setup
      `.execute(db.db)
      expect(rows[0].is_called).toBe(false)
    } finally {
      controller.abort()
      await result
      await freshDb.close()
      await sql`DROP SEQUENCE read_query_during_setup`.execute(db.db)
    }
  })

  it('does not execute queued SQL after a disconnect', async () => {
    const held = await db.pool.connect()
    const controller = new AbortController()
    const result = executeReadQuery(
      db,
      sql`SELECT pg_sleep(10) /* read_query_queued */`.compile(db.db),
      controller.signal,
    ).catch((err) => err)
    try {
      await until(async () => db.pool.waitingCount > 0)
      controller.abort(new Error('Disconnected'))
      const error = await result
      expect(error).toBe(controller.signal.reason)
    } finally {
      controller.abort()
      held.release()
      await result
    }
    // @NOTE the aborted checkout is released when pg eventually supplies it.
    await sql`SELECT 1`.execute(db.db)
    expect(db.pool.waitingCount).toBe(0)
    expect(await queryIsActive('%read_query_queued%')).toBe(false)
  })

  it('holds the connection until delayed cancellation settles', async () => {
    const connection = await db.db
      .getExecutor()
      .provideConnection(async (c) => c)
    const originalCancel = connection.cancelQuery!.bind(connection)
    let finishCancel!: () => void
    const delayed = new Promise<void>((resolve) => {
      finishCancel = resolve
    })
    using cancel = jest
      .spyOn(connection, 'cancelQuery')
      .mockImplementation(async (provider) => {
        await delayed
        await originalCancel(provider)
      })
    const controller = new AbortController()
    const result = executeReadQuery(
      db,
      sql`SELECT pg_sleep(0.1) /* read_query_delayed_cancel */`.compile(db.db),
      controller.signal,
    ).catch((err) => err)
    try {
      await until(() => queryIsActive('%read_query_delayed_cancel%'))
      controller.abort()
      await until(async () => cancel.mock.calls.length > 0)
      await until(
        async () => !(await queryIsActive('%read_query_delayed_cancel%')),
      )
      expect(db.pool.idleCount).toBe(0)
    } finally {
      finishCancel()
      controller.abort()
      await result
    }
    await expect(sql`SELECT 1`.execute(db.db)).resolves.toMatchObject({
      rows: [{ '?column?': 1 }],
    })
  })

  it.each([
    [tools.ozone.moderation.queryEvents.$lxm, 'moderation_event'],
    [tools.ozone.moderation.queryStatuses.$lxm, 'moderation_subject_status'],
  ])('cancels %s SQL when the HTTP client disconnects', async (nsid, table) => {
    const locker = await db.pool.connect()
    const controller = new AbortController()
    // @NOTE pg_stat_activity truncates the long status projection before FROM.
    const pattern =
      table === 'moderation_subject_status'
        ? 'select "moderation_subject_status".*%'
        : `%from "${table}"%limit%`
    let request: Promise<unknown> | undefined
    try {
      await locker.query('BEGIN')
      await locker.query(`LOCK TABLE "${table}" IN ACCESS EXCLUSIVE MODE`)
      request = fetch(`${network.ozone.url}/xrpc/${nsid}?limit=1`, {
        headers: await network.ozone.modHeaders(nsid),
        signal: controller.signal,
      }).catch((err) => err)
      await until(() => queryIsActive(pattern))
      controller.abort()
      expect(await request).toMatchObject({ name: 'AbortError' })
      // @NOTE the table remains locked: disappearance proves SQL was cancelled.
      await until(async () => !(await queryIsActive(pattern)))
    } finally {
      controller.abort()
      await request
      await locker.query('ROLLBACK')
      locker.release()
    }
    const response = await fetch(`${network.ozone.url}/xrpc/${nsid}?limit=1`, {
      headers: await network.ozone.modHeaders(nsid),
    })
    expect(response.status).toBe(200)
    await response.json()
  })
})
