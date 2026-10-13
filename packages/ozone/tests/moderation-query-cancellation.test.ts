import { sql } from 'kysely'
import { wait } from '@atproto/common'
import { TestNetwork } from '@atproto/dev-env'
import { Database } from '../src/db/index.js'
import { tools } from '../src/lexicons/index.js'

describe('moderation query cancellation', () => {
  let network: TestNetwork
  let db: Database

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_query_cancellation',
      // @NOTE one connection is held by the label channel's LISTEN subscription.
      ozone: { dbPoolSize: 2 },
    })
    db = new Database({
      ...network.ozone.ctx.db.opts,
      pool: undefined,
      poolSize: 2,
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
    `.execute(db.db)
    return rows[0].active
  }

  async function until(check: () => Promise<boolean>) {
    const deadline = performance.now() + 2000
    while (!(await check())) {
      if (performance.now() >= deadline) throw new Error('Condition timed out')
      await wait(10)
    }
  }

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
    const result = sql`SELECT nextval('read_query_during_setup')`
      .execute(freshDb.db, {
        signal: controller.signal,
        inflightQueryAbortStrategy: 'cancel query',
      })
      .catch((err) => err)
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

  it.each([
    [tools.ozone.moderation.queryEvents.$lxm, 'moderation_event'],
    [tools.ozone.moderation.queryStatuses.$lxm, 'moderation_subject_status'],
  ])(
    'cancels %s SQL on HTTP disconnect with a full API pool',
    async (nsid, table) => {
      const apiDb = network.ozone.ctx.db
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
        expect(apiDb.pool.totalCount).toBe(2)
        expect(apiDb.pool.idleCount).toBe(0)
        controller.abort()
        expect(await request).toMatchObject({ name: 'AbortError' })
        // @NOTE the table remains locked: disappearance proves SQL was cancelled.
        await until(async () => !(await queryIsActive(pattern)))
        await until(async () => apiDb.pool.idleCount === 1)
      } finally {
        controller.abort()
        await request
        await locker.query('ROLLBACK')
        locker.release()
      }
      const response = await fetch(
        `${network.ozone.url}/xrpc/${nsid}?limit=1`,
        {
          headers: await network.ozone.modHeaders(nsid),
        },
      )
      expect(response.status).toBe(200)
      await response.json()
    },
  )
})
