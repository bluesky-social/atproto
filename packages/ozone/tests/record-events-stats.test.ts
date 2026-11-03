import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  sql,
} from 'kysely'
import pg, { type PoolClient } from 'pg'
import { ComAtprotoModerationDefs } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import {
  type AtUriString,
  type DidString,
  toDatetimeString,
} from '@atproto/lex'
import { OZONE_APPEAL_REASON_TYPE } from '../src/api/util.js'
import { RecordEventsStatsWorker } from '../src/daemon/record-events-stats-worker.js'
import { Database } from '../src/db/index.js'
import * as migration from '../src/db/migrations/20261101T000000000Z-record-events-stats-incremental-tables.js'
import type { ModerationEvent } from '../src/db/schema/moderation_event.js'
import { chat, com, tools } from '../src/lexicons/index.js'

type RecordStats = {
  subjectDid: string
  subjectKey: string
  escalateCount: number
  reportCount: number
  appealCount: number
}

type AccountStats = {
  subjectDid: string
  totalReports: number
  reportedCount: number
  escalatedCount: number
  appealedCount: number
}

type Delta = {
  subjectDid: string
  subjectKey: string
  escalateDelta: number
  reportDelta: number
  appealDelta: number
}

const REPORT = tools.ozone.moderation.defs.modEventReport.$type
const ESCALATE = tools.ozone.moderation.defs.modEventEscalate.$type
const COMMENT = tools.ozone.moderation.defs.modEventComment.$type
const STRONG_REF = com.atproto.repo.strongRef.$type
const SPAM = ComAtprotoModerationDefs.REASONSPAM

const byDidAndKey = (
  a: { subjectDid: string; subjectKey: string },
  b: { subjectDid: string; subjectKey: string },
) =>
  a.subjectDid < b.subjectDid
    ? -1
    : a.subjectDid > b.subjectDid
      ? 1
      : a.subjectKey < b.subjectKey
        ? -1
        : a.subjectKey > b.subjectKey
          ? 1
          : 0

const byDid = (a: AccountStats, b: AccountStats) =>
  a.subjectDid < b.subjectDid ? -1 : a.subjectDid > b.subjectDid ? 1 : 0

// The record_events_stats materialized view as defined by
// 20260720T000000000Z, kept independent of the SQL under test.
const convoId = sql`COALESCE(NULLIF(${sql.ref('subjectConvoId')}, ''), NULLIF(${sql.ref('meta')} ->> 'convoId', ''))`
const subjectKey = sql<string>`COALESCE(${sql.ref('subjectUri')}, ${convoId})`

const originalAggregate = async (db: Database): Promise<RecordStats[]> => {
  const rows = await db.db
    .selectFrom('moderation_event')
    .select([
      'subjectDid',
      () => subjectKey.as('subjectKey'),
      (eb) =>
        sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = ${tools.ozone.moderation.defs.modEventEscalate.$type})`.as(
          'escalateCount',
        ),
      (eb) =>
        sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = ${tools.ozone.moderation.defs.modEventReport.$type} AND ${eb.ref('meta')} ->> 'reportType' NOT IN (${com.atproto.moderation.defs.reasonAppeal.value}, ${OZONE_APPEAL_REASON_TYPE}))`.as(
          'reportCount',
        ),
      (eb) =>
        sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = ${tools.ozone.moderation.defs.modEventReport.$type} AND ${eb.ref('meta')} ->> 'reportType' IN (${com.atproto.moderation.defs.reasonAppeal.value}, ${OZONE_APPEAL_REASON_TYPE}))`.as(
          'appealCount',
        ),
    ])
    .where((eb) =>
      eb.or([
        eb.and([
          eb('subjectType', '=', com.atproto.repo.strongRef.$type),
          eb('subjectUri', 'is not', null),
        ]),
        eb.and([
          eb('subjectType', 'in', [
            chat.bsky.convo.defs.convoRef.$type,
            chat.bsky.convo.defs.messageRef.$type,
          ]),
          sql<boolean>`${convoId} IS NOT NULL`,
        ]),
      ]),
    )
    .groupBy(['subjectDid', subjectKey])
    .execute()
  return rows.sort(byDidAndKey)
}

// account_record_events_stats as defined over record_events_stats.
const accountStatsOf = (records: RecordStats[]): AccountStats[] => {
  const accounts = new Map<string, AccountStats>()
  for (const r of records) {
    const acc = accounts.get(r.subjectDid) ?? {
      subjectDid: r.subjectDid,
      totalReports: 0,
      reportedCount: 0,
      escalatedCount: 0,
      appealedCount: 0,
    }
    acc.totalReports += r.reportCount
    if (r.reportCount > 0) acc.reportedCount++
    if (r.escalateCount > 0) acc.escalatedCount++
    if (r.appealCount > 0) acc.appealedCount++
    accounts.set(r.subjectDid, acc)
  }
  return [...accounts.values()].sort(byDid)
}

const liveStats = async (db: Database): Promise<RecordStats[]> => {
  const { rows } = await sql<RecordStats>`
    SELECT "subjectDid", "subjectKey", "escalateCount", "reportCount", "appealCount"
    FROM record_events_stats_live
  `.execute(db.db)
  return rows.sort(byDidAndKey)
}

const liveAccountStats = async (db: Database): Promise<AccountStats[]> => {
  const { rows } = await sql<AccountStats>`${sql.raw(
    migration.ACCOUNT_STATS_SELECT_SQL,
  )}`.execute(db.db)
  return rows.sort(byDid)
}

const maxDeltaId = async (db: Database): Promise<number> => {
  const { rows } = await sql<{
    max: number | null
  }>`SELECT max(id) AS max FROM record_events_stats_delta`.execute(db.db)
  return rows[0]?.max ?? 0
}

const deltasAfter = async (db: Database, id: number): Promise<Delta[]> => {
  const { rows } = await sql<Delta>`
    SELECT "subjectDid", "subjectKey", "escalateDelta", "reportDelta", "appealDelta"
    FROM record_events_stats_delta
    WHERE id > ${id}
    ORDER BY id
  `.execute(db.db)
  return rows
}

const maxEventId = async (db: Database): Promise<number> => {
  const row = await db.db
    .selectFrom('moderation_event')
    .select((eb) => eb.fn.max('id').as('max'))
    .executeTakeFirstOrThrow()
  return row.max
}

const backfillCursor = async (db: Database): Promise<unknown> => {
  const row = await db.db
    .selectFrom('job_cursor')
    .select('cursor')
    .where('job', '=', migration.RECORD_EVENTS_STATS_BACKFILL_JOB)
    .executeTakeFirst()
  return row?.cursor ? JSON.parse(row.cursor) : row
}

// Rows the current transaction wrote to a table, triggers included.
const xactWrites = async (txn: Database, table: string): Promise<number> => {
  const { rows } = await sql<{ writes: number }>`
    SELECT pg_stat_get_xact_tuples_inserted(${table}::regclass)
      + pg_stat_get_xact_tuples_updated(${table}::regclass)
      + pg_stat_get_xact_tuples_deleted(${table}::regclass) AS writes
  `.execute(txn.db)
  return rows[0].writes
}

const relkind = async (db: Database, name: string) => {
  const { rows } = await sql<{
    relkind: string
  }>`SELECT relkind FROM pg_class WHERE oid = to_regclass(${name})`.execute(
    db.db,
  )
  return rows[0]?.relkind
}

const waitFor = async (check: () => Promise<boolean>) => {
  const deadline = Date.now() + 10_000
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('timed out waiting')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

class Rollback extends Error {
  constructor(readonly result: unknown) {
    super('rollback')
  }
}

describe('record_events_stats incremental tables', () => {
  describe('migration SQL', () => {
    const capture = async (fn: (db: Kysely<any>) => Promise<void>) => {
      const queries: string[] = []
      const db = new Kysely<any>({
        dialect: {
          createAdapter: () => new PostgresAdapter(),
          createDriver: () => new DummyDriver(),
          createIntrospector: (db) => new PostgresIntrospector(db),
          createQueryCompiler: () => new PostgresQueryCompiler(),
        },
        log: (event) => {
          if (event.level === 'query') queries.push(event.query.sql)
        },
      })
      await fn(db)
      await db.destroy()
      return queries
    }

    it('up() runs the exported SQL, reading the watermark after creating the triggers', async () => {
      expect(await capture(migration.up)).toEqual([
        `SET LOCAL lock_timeout = '5s'`,
        migration.CREATE_LIVE_TABLE_SQL,
        migration.CREATE_DELTA_TABLE_SQL,
        migration.TRACK_FUNCTION_SQL,
        ...migration.TRIGGERS_SQL,
        migration.INIT_BACKFILL_CURSOR_SQL,
      ])
      expect(migration.TRIGGERS_SQL).toHaveLength(3)
    })
  })

  describe('maintenance', () => {
    let network: TestNetwork
    let db: Database
    let sc: SeedClient
    let modClient: ModeratorClient
    let worker: RecordEventsStatsWorker

    beforeAll(async () => {
      network = await TestNetwork.create({
        dbPostgresSchema: 'ozone_record_events_stats',
      })
      // Folding is driven by the tests
      await network.ozone.daemon.ctx.recordEventsStatsWorker.destroy()
      db = network.ozone.ctx.db
      sc = network.getSeedClient()
      modClient = network.ozone.getModClient()
      worker = new RecordEventsStatsWorker(db)
      await basicSeed(sc)
      await network.processAll()
    })

    afterAll(async () => {
      await network?.close()
    })

    const postRef = (did: DidString, index: number) => ({
      $type: com.atproto.repo.strongRef.$type,
      uri: sc.posts[did][index].ref.uriStr,
      cid: sc.posts[did][index].ref.cidStr,
    })

    // Also for event shapes the API no longer produces.
    const insertEvent = async (
      dbOrTxn: Database,
      values: {
        action: ModerationEvent['action']
        subjectType: ModerationEvent['subjectType']
        subjectDid: DidString
        subjectUri?: AtUriString
        subjectConvoId?: string
        meta?: Record<string, string>
      },
    ) => {
      const row = await dbOrTxn.db
        .insertInto('moderation_event')
        .values({
          ...values,
          createdAt: toDatetimeString(new Date()),
          createdBy: 'did:example:admin',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      return row.id
    }

    const insertReport = (subjectDid: DidString, subjectUri: AtUriString) =>
      insertEvent(db, {
        action: REPORT,
        subjectType: STRONG_REF,
        subjectDid,
        subjectUri,
        meta: { reportType: SPAM },
      })

    const findEventId = async (
      action: string,
      subjectUri: string,
    ): Promise<number> => {
      const row = await db.db
        .selectFrom('moderation_event')
        .select('id')
        .where('action', '=', action as any)
        .where('subjectUri', '=', subjectUri as any)
        .orderBy('id', 'asc')
        .executeTakeFirstOrThrow()
      return row.id
    }

    const rolledBack = async <T>(
      fn: (txn: Database) => Promise<T>,
    ): Promise<T> => {
      try {
        await db.transaction(async (txn) => {
          throw new Rollback(await fn(txn))
        })
      } catch (err) {
        if (err instanceof Rollback) return err.result as T
        throw err
      }
      throw new Error('not rolled back')
    }

    const migrate = (fn: (db: Kysely<any>) => Promise<void>) =>
      db.transaction((txn) => fn(txn.db as unknown as Kysely<any>))

    const expectParity = async () => {
      await worker.processAll()
      const expected = await originalAggregate(db)
      expect(await liveStats(db)).toEqual(expected)
      expect(await liveAccountStats(db)).toEqual(accountStatsOf(expected))
      expect(await deltasAfter(db, 0)).toEqual([])
      return expected
    }

    const find = (stats: RecordStats[], did: string, key: string) =>
      stats.find((r) => r.subjectDid === did && r.subjectKey === key)

    // Three keys of one subject DID, in key order.
    const orderedKeys = () =>
      ['a', 'b', 'c'].map(
        (suffix): AtUriString =>
          `at://${sc.dids.dan}/app.bsky.feed.post/ordered-${suffix}`,
      )

    const isRowLocked = async (
      client: PoolClient,
      did: string,
      key: string,
    ) => {
      await client.query('BEGIN')
      try {
        await client.query(
          `SELECT 1 FROM record_events_stats_live
          WHERE "subjectDid" = $1 AND "subjectKey" = $2
          FOR UPDATE NOWAIT`,
          [did, key],
        )
        return false
      } catch (err) {
        if ((err as { code?: string }).code === '55P03') return true
        throw err
      } finally {
        await client.query('ROLLBACK')
      }
    }

    // Holds the middle key's row while run() upserts all three keys, which
    // must have rows already, then checks run() has locked the first key's
    // row but not yet the last's.
    const expectKeyOrderedUpsert = async (
      did: string,
      [first, middle, last]: string[],
      run: () => Promise<unknown>,
    ) => {
      const holder = await db.pool.connect()
      const probe = await db.pool.connect()
      let running: Promise<unknown> | undefined
      try {
        await holder.query('BEGIN')
        const { rows } = await holder.query(
          `SELECT pg_backend_pid() AS pid FROM record_events_stats_live
          WHERE "subjectDid" = $1 AND "subjectKey" = $2
          FOR UPDATE`,
          [did, middle],
        )
        expect(rows).toHaveLength(1)
        running = run()
        await waitFor(async () => {
          const blocked = await probe.query(
            `SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))`,
            [rows[0].pid],
          )
          return blocked.rows.length > 0
        })
        expect(await isRowLocked(probe, did, first)).toBe(true)
        expect(await isRowLocked(probe, did, last)).toBe(false)
      } finally {
        await holder.query('ROLLBACK')
        holder.release()
        probe.release()
        await running
      }
    }

    it('queues deltas from the triggers without writing the live table', async () => {
      const bobPost = postRef(sc.dids.bob, 0).uri
      const otherPost = postRef(sc.dids.bob, 1).uri
      const steps = await rolledBack(async (txn) => {
        const step = async (fn: () => Promise<unknown>) => {
          const before = await maxDeltaId(txn)
          await fn()
          return (await deltasAfter(txn, before)).sort(byDidAndKey)
        }
        let reportId = 0
        let commentId = 0
        const result = {
          report: await step(async () => {
            reportId = await insertEvent(txn, {
              action: REPORT,
              subjectType: STRONG_REF,
              subjectDid: sc.dids.bob,
              subjectUri: bobPost,
              meta: { reportType: SPAM },
            })
          }),
          comment: await step(async () => {
            commentId = await insertEvent(txn, {
              action: COMMENT,
              subjectType: STRONG_REF,
              subjectDid: sc.dids.bob,
              subjectUri: otherPost,
            })
          }),
          outOfScope: await step(async () => {
            await insertEvent(txn, {
              action: REPORT,
              subjectType: com.atproto.admin.defs.repoRef.$type,
              subjectDid: sc.dids.dan,
              meta: { reportType: SPAM },
            })
            // A record subject type, but no convoId
            await insertEvent(txn, {
              action: REPORT,
              subjectType: chat.bsky.convo.defs.messageRef.$type,
              subjectDid: sc.dids.alice,
              meta: { reportType: SPAM },
            })
          }),
          reportToEscalate: await step(() =>
            sql`UPDATE moderation_event SET action = ${ESCALATE} WHERE id = ${reportId}`.execute(
              txn.db,
            ),
          ),
          moveSubject: await step(() =>
            sql`UPDATE moderation_event SET "subjectUri" = ${otherPost} WHERE id = ${reportId}`.execute(
              txn.db,
            ),
          ),
          untrackedColumn: await step(() =>
            sql`UPDATE moderation_event SET comment = 'edited' WHERE id = ${reportId}`.execute(
              txn.db,
            ),
          ),
          unchanged: await step(() =>
            sql`UPDATE moderation_event SET action = action WHERE id = ${reportId}`.execute(
              txn.db,
            ),
          ),
          deleteCounted: await step(() =>
            txn.db
              .deleteFrom('moderation_event')
              .where('id', '=', reportId)
              .execute(),
          ),
          deleteUncounted: await step(() =>
            txn.db
              .deleteFrom('moderation_event')
              .where('id', '=', commentId)
              .execute(),
          ),
          liveWrites: await xactWrites(txn, 'record_events_stats_live'),
          deltaWrites: await xactWrites(txn, 'record_events_stats_delta'),
        }
        return result
      })

      const delta = (
        subjectKey: string,
        escalateDelta: number,
        reportDelta: number,
        appealDelta = 0,
      ): Delta => ({
        subjectDid: sc.dids.bob,
        subjectKey,
        escalateDelta,
        reportDelta,
        appealDelta,
      })
      expect(steps).toEqual({
        report: [delta(bobPost, 0, 1)],
        // Nothing counted, but the subject gets a row
        comment: [delta(otherPost, 0, 0)],
        outOfScope: [],
        reportToEscalate: [delta(bobPost, 1, -1)],
        moveSubject: [delta(bobPost, -1, 0), delta(otherPost, 1, 0)].sort(
          byDidAndKey,
        ),
        untrackedColumn: [],
        unchanged: [delta(otherPost, 0, 0)],
        deleteCounted: [delta(otherPost, -1, 0)],
        deleteUncounted: [],
        liveWrites: 0,
        deltaWrites: 7,
      })
    })

    it('folds deltas into the live table, matching the original aggregate', async () => {
      const bobPost = postRef(sc.dids.bob, 0)
      await sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: bobPost,
      })
      await sc.createReport({
        reportedBy: sc.dids.carol,
        reasonType: ComAtprotoModerationDefs.REASONMISLEADING,
        subject: bobPost,
      })
      await sc.createReport({
        reportedBy: sc.dids.dan,
        reasonType: ComAtprotoModerationDefs.REASONRUDE,
        subject: bobPost,
      })
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: ComAtprotoModerationDefs.REASONAPPEAL,
        },
        subject: bobPost,
      })
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: OZONE_APPEAL_REASON_TYPE,
        },
        subject: bobPost,
      })
      await modClient.emitEvent({
        event: { $type: 'tools.ozone.moderation.defs#modEventEscalate' },
        subject: postRef(sc.dids.bob, 1),
      })

      // Not counted, but still gets a row of zeros
      const carolPost = postRef(sc.dids.carol, 0)
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventComment',
          comment: 'looked at it',
        },
        subject: carolPost,
      })
      await modClient.emitEvent({
        event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
        subject: carolPost,
      })

      await sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: {
          $type: 'chat.bsky.convo.defs#convoRef',
          did: sc.dids.carol,
          convoId: 'convo-a',
        },
      })
      await sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: {
          $type: 'chat.bsky.convo.defs#messageRef',
          did: sc.dids.carol,
          messageId: 'message-1',
          convoId: 'convo-b',
        },
      })
      // No convoId: out of scope
      await sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: {
          $type: 'chat.bsky.convo.defs#messageRef',
          did: sc.dids.alice,
          messageId: 'message-2',
        },
      })
      // Account-level: out of scope
      await sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.dan,
        },
      })

      // A report without reportType counts as neither report nor appeal
      const alicePost = postRef(sc.dids.alice, 0)
      await insertEvent(db, {
        action: REPORT,
        subjectType: STRONG_REF,
        subjectDid: sc.dids.alice,
        subjectUri: alicePost.uri,
        meta: {},
      })
      // Events predating subjectConvoId fall back to meta->>'convoId'
      await insertEvent(db, {
        action: REPORT,
        subjectType: chat.bsky.convo.defs.messageRef.$type,
        subjectDid: sc.dids.carol,
        meta: {
          convoId: 'convo-legacy',
          reportType: ComAtprotoModerationDefs.REASONSPAM,
        },
      })
      await insertEvent(db, {
        action: REPORT,
        subjectType: chat.bsky.convo.defs.convoRef.$type,
        subjectDid: sc.dids.carol,
        subjectConvoId: '',
        meta: {
          convoId: 'convo-legacy',
          reportType: ComAtprotoModerationDefs.REASONSPAM,
        },
      })
      // Empty convoIds everywhere: out of scope
      await insertEvent(db, {
        action: ESCALATE,
        subjectType: chat.bsky.convo.defs.convoRef.$type,
        subjectDid: sc.dids.alice,
        subjectConvoId: '',
        meta: { convoId: '' },
      })

      // Nothing reaches the table until the worker folds the deltas
      expect(await liveStats(db)).toEqual([])
      const stats = await expectParity()

      // The fixtures cover what they claim to
      expect(find(stats, sc.dids.bob, bobPost.uri)).toEqual(
        expect.objectContaining({
          reportCount: 3,
          appealCount: 2,
          escalateCount: 0,
        }),
      )
      expect(find(stats, sc.dids.bob, postRef(sc.dids.bob, 1).uri)).toEqual(
        expect.objectContaining({ escalateCount: 1 }),
      )
      expect(find(stats, sc.dids.carol, carolPost.uri)).toEqual(
        expect.objectContaining({
          reportCount: 0,
          appealCount: 0,
          escalateCount: 0,
        }),
      )
      expect(find(stats, sc.dids.alice, alicePost.uri)).toEqual(
        expect.objectContaining({
          reportCount: 0,
          appealCount: 0,
          escalateCount: 0,
        }),
      )
      expect(find(stats, sc.dids.carol, 'convo-a')?.reportCount).toBe(1)
      expect(find(stats, sc.dids.carol, 'convo-b')?.reportCount).toBe(1)
      expect(find(stats, sc.dids.carol, 'convo-legacy')?.reportCount).toBe(2)
      expect(stats.filter((r) => r.subjectDid === sc.dids.dan)).toEqual([])
      expect(stats.filter((r) => r.subjectKey === '')).toEqual([])
    })

    it('subtracts deleted events', async () => {
      const bobPost = postRef(sc.dids.bob, 0)
      const id = await findEventId(REPORT, bobPost.uri)
      await db.db.deleteFrom('moderation_event').where('id', '=', id).execute()

      const stats = await expectParity()
      expect(find(stats, sc.dids.bob, bobPost.uri)?.reportCount).toBe(2)
    })

    it('moves counts when an event is updated', async () => {
      const bobPost = postRef(sc.dids.bob, 0)
      const reportId = await findEventId(REPORT, bobPost.uri)
      await sql`UPDATE moderation_event SET action = ${ESCALATE} WHERE id = ${reportId}`.execute(
        db.db,
      )
      let stats = await expectParity()
      expect(find(stats, sc.dids.bob, bobPost.uri)).toEqual(
        expect.objectContaining({ reportCount: 1, escalateCount: 1 }),
      )

      // Report to appeal
      const otherReportId = await findEventId(REPORT, bobPost.uri)
      await sql`UPDATE moderation_event SET meta = jsonb_set(meta, '{reportType}', to_jsonb(${com.atproto.moderation.defs.reasonAppeal.value}::text)) WHERE id = ${otherReportId}`.execute(
        db.db,
      )
      stats = await expectParity()
      expect(find(stats, sc.dids.bob, bobPost.uri)).toEqual(
        expect.objectContaining({ reportCount: 0, appealCount: 3 }),
      )

      // To another subject, which gets a row
      const alicePost = postRef(sc.dids.alice, 1)
      await sql`UPDATE moderation_event SET "subjectDid" = ${sc.dids.alice}, "subjectUri" = ${alicePost.uri} WHERE id = ${reportId}`.execute(
        db.db,
      )
      stats = await expectParity()
      expect(find(stats, sc.dids.alice, alicePost.uri)).toEqual(
        expect.objectContaining({ escalateCount: 1 }),
      )

      // Touching a tracked column without changing it is a no-op
      await sql`UPDATE moderation_event SET action = action WHERE "subjectUri" = ${bobPost.uri}`.execute(
        db.db,
      )
      await expectParity()
    })

    it('folds deltas in subject key order', async () => {
      const keys = orderedKeys()
      for (const key of keys) await insertReport(sc.dids.dan, key)
      await worker.processAll()

      // Queued in reverse key order
      for (const key of [...keys].reverse()) {
        await insertReport(sc.dids.dan, key)
      }
      await expectKeyOrderedUpsert(sc.dids.dan, keys, () =>
        worker.processFoldBatch(),
      )

      const stats = await expectParity()
      for (const key of keys) {
        expect(find(stats, sc.dids.dan, key)?.reportCount).toBe(2)
      }
    })

    it('backfills events up to the watermark in batches', async () => {
      await migrate(migration.down)
      expect(await relkind(db, 'record_events_stats_live')).toBeUndefined()
      expect(await relkind(db, 'record_events_stats_delta')).toBeUndefined()
      expect(await backfillCursor(db)).toBeUndefined()
      const { rows: triggers } = await sql`
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'moderation_event'::regclass
          AND tgname LIKE 'moderation_event_record_stats_%'
      `.execute(db.db)
      expect(triggers).toEqual([])

      // Without triggers, only the backfill sees these
      const danPost = postRef(sc.dids.dan, 0).uri
      const danOtherPost = postRef(sc.dids.dan, 1).uri
      await insertReport(sc.dids.dan, danPost)
      await insertEvent(db, {
        action: COMMENT,
        subjectType: STRONG_REF,
        subjectDid: sc.dids.dan,
        subjectUri: danOtherPost,
      })

      await migrate(migration.up)
      const watermark = await maxEventId(db)
      expect(await backfillCursor(db)).toEqual({ watermark, next: 0 })
      expect(await liveStats(db)).toEqual([])

      // Above the watermark, so only through the delta table
      await insertReport(sc.dids.dan, danPost)
      expect(await deltasAfter(db, 0)).toEqual([
        {
          subjectDid: sc.dids.dan,
          subjectKey: danPost,
          escalateDelta: 0,
          reportDelta: 1,
          appealDelta: 0,
        },
      ])

      // Competing workers neither skip nor repeat a batch or delta
      const summaries = await Promise.all(
        [1, 2].map(() =>
          new RecordEventsStatsWorker(db, { backfillBatchIds: 2 }).processAll(),
        ),
      )
      expect(summaries.reduce((sum, s) => sum + s.backfilledIds, 0)).toBe(
        watermark,
      )
      expect(summaries.reduce((sum, s) => sum + s.backfillBatches, 0)).toBe(
        Math.ceil(watermark / 2),
      )
      expect(Math.ceil(watermark / 2)).toBeGreaterThan(10)
      expect(await backfillCursor(db)).toEqual({
        watermark,
        next: watermark,
        done: true,
      })

      const stats = await expectParity()
      expect(find(stats, sc.dids.dan, danPost)?.reportCount).toBe(2)
      expect(find(stats, sc.dids.dan, danOtherPost)).toEqual({
        subjectDid: sc.dids.dan,
        subjectKey: danOtherPost,
        escalateCount: 0,
        reportCount: 0,
        appealCount: 0,
      })
    })

    it('backfills in subject key order', async () => {
      await migrate(migration.down)
      await migrate(migration.up)
      const watermark = await maxEventId(db)

      // The keys' events are all below the watermark; give them rows to lock
      const keys = orderedKeys()
      for (const key of keys) {
        await sql`INSERT INTO record_events_stats_live ("subjectDid", "subjectKey") VALUES (${sc.dids.dan}, ${key})`.execute(
          db.db,
        )
      }
      // Hash aggregation, so that without the ORDER BY the batch would not
      // already come out in key order.
      const hashAggDb = new Database({
        ...db.opts,
        pool: new pg.Pool({
          connectionString: db.opts.url,
          options: '-c enable_sort=off',
        }),
      })
      try {
        const backfiller = new RecordEventsStatsWorker(hashAggDb)
        await expectKeyOrderedUpsert(sc.dids.dan, keys, () =>
          backfiller.processBackfillBatch(),
        )
      } finally {
        await hashAggDb.close()
      }
      expect(await backfillCursor(db)).toEqual({
        watermark,
        next: watermark,
        done: true,
      })

      const stats = await expectParity()
      for (const key of keys) {
        expect(find(stats, sc.dids.dan, key)?.reportCount).toBe(2)
      }
    })

    it('keeps a zero-count row when the last event of a subject is deleted', async () => {
      const bobPost = postRef(sc.dids.bob, 1).uri
      await db.db
        .deleteFrom('moderation_event')
        .where('subjectUri', '=', bobPost)
        .execute()
      await worker.processAll()

      expect(
        find(await originalAggregate(db), sc.dids.bob, bobPost),
      ).toBeUndefined()
      expect(find(await liveStats(db), sc.dids.bob, bobPost)).toEqual({
        subjectDid: sc.dids.bob,
        subjectKey: bobPost,
        escalateCount: 0,
        reportCount: 0,
        appealCount: 0,
      })
    })
  })
})
