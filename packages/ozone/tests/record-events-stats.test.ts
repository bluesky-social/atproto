import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  sql,
} from 'kysely'
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
import * as migration from '../src/db/migrations/20261101T000000000Z-incremental-record-events-stats.js'
import type { Database } from '../src/index.js'
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

const byDidAndKey = (a: RecordStats, b: RecordStats) =>
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

const recordStats = async (db: Database): Promise<RecordStats[]> => {
  const rows = await db.db
    .selectFrom('record_events_stats')
    .selectAll()
    .execute()
  return rows.sort(byDidAndKey)
}

const accountStats = async (db: Database): Promise<AccountStats[]> => {
  const rows = await db.db
    .selectFrom('account_record_events_stats')
    .selectAll()
    .execute()
  return rows.sort(byDid)
}

const relkind = async (db: Database, name: string) => {
  const { rows } = await sql<{
    relkind: string
  }>`SELECT relkind FROM pg_class WHERE oid = to_regclass(${name})`.execute(
    db.db,
  )
  return rows[0]?.relkind
}

describe('record_events_stats', () => {
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

    it('up() executes the exported SQL, creating triggers before the backfill', async () => {
      const queries = await capture(migration.up)
      const indexOf = (query: string) => {
        const index = queries.indexOf(query)
        expect(index).toBeGreaterThanOrEqual(0)
        return index
      }

      const table = indexOf(migration.CREATE_LIVE_TABLE_SQL)
      const fn = indexOf(migration.TRACK_FUNCTION_SQL)
      const triggers = migration.TRIGGERS_SQL.map(indexOf)
      expect(triggers).toHaveLength(3)
      const backfill = queries.findIndex(
        (query) =>
          query.startsWith('INSERT INTO record_events_stats_live ') &&
          query.endsWith(
            `\n${migration.RECORD_STATS_AGGREGATE_SQL}\n${migration.RECORD_STATS_GROUP_BY_SQL}`,
          ),
      )
      const accountView = queries.findIndex(
        (query) =>
          query.includes('"account_record_events_stats_new"') &&
          query.endsWith(migration.ACCOUNT_STATS_SELECT_SQL),
      )
      const view = indexOf(migration.RECORD_STATS_VIEW_SQL)

      expect(table).toBeLessThan(fn)
      expect(Math.min(...triggers)).toBeGreaterThan(fn)
      expect(backfill).toBeGreaterThan(Math.max(...triggers))
      expect(accountView).toBeGreaterThan(backfill)
      expect(view).toBeGreaterThan(accountView)
    })

    it('down() rebuilds the materialized view from the exported aggregate', async () => {
      const queries = await capture(migration.down)
      expect(
        queries.some(
          (query) =>
            query.includes('"record_events_stats_new"') &&
            query.endsWith(
              `${migration.RECORD_STATS_AGGREGATE_SQL}\n${migration.RECORD_STATS_GROUP_BY_SQL}`,
            ),
        ),
      ).toBe(true)
    })
  })

  describe('trigger maintenance', () => {
    let network: TestNetwork
    let db: Database
    let sc: SeedClient
    let modClient: ModeratorClient

    beforeAll(async () => {
      network = await TestNetwork.create({
        dbPostgresSchema: 'ozone_record_events_stats',
      })
      db = network.ozone.ctx.db
      sc = network.getSeedClient()
      modClient = network.ozone.getModClient()
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

    // For event shapes the API no longer produces.
    const insertEvent = async (
      dbOrTxn: Database,
      values: {
        action:
          | typeof tools.ozone.moderation.defs.modEventReport.$type
          | typeof tools.ozone.moderation.defs.modEventEscalate.$type
        subjectType:
          | typeof com.atproto.repo.strongRef.$type
          | typeof chat.bsky.convo.defs.convoRef.$type
          | typeof chat.bsky.convo.defs.messageRef.$type
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

    const expectParity = async () => {
      const expected = await originalAggregate(db)
      expect(await recordStats(db)).toEqual(expected)
      await network.ozone.daemon.ctx.materializedViewRefresher.run()
      expect(await accountStats(db)).toEqual(accountStatsOf(expected))
      return expected
    }

    it('matches the original aggregate for every kind of event', async () => {
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
        action: tools.ozone.moderation.defs.modEventReport.$type,
        subjectType: com.atproto.repo.strongRef.$type,
        subjectDid: sc.dids.alice,
        subjectUri: alicePost.uri,
        meta: {},
      })
      // Events predating subjectConvoId fall back to meta->>'convoId'
      await insertEvent(db, {
        action: tools.ozone.moderation.defs.modEventReport.$type,
        subjectType: chat.bsky.convo.defs.messageRef.$type,
        subjectDid: sc.dids.carol,
        meta: {
          convoId: 'convo-legacy',
          reportType: ComAtprotoModerationDefs.REASONSPAM,
        },
      })
      await insertEvent(db, {
        action: tools.ozone.moderation.defs.modEventReport.$type,
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
        action: tools.ozone.moderation.defs.modEventEscalate.$type,
        subjectType: chat.bsky.convo.defs.convoRef.$type,
        subjectDid: sc.dids.alice,
        subjectConvoId: '',
        meta: { convoId: '' },
      })

      const stats = await expectParity()

      // The fixtures cover what they claim to
      const find = (did: string, key: string) =>
        stats.find((r) => r.subjectDid === did && r.subjectKey === key)
      expect(find(sc.dids.bob, bobPost.uri)).toEqual(
        expect.objectContaining({
          reportCount: 3,
          appealCount: 2,
          escalateCount: 0,
        }),
      )
      expect(find(sc.dids.bob, postRef(sc.dids.bob, 1).uri)).toEqual(
        expect.objectContaining({ escalateCount: 1 }),
      )
      expect(find(sc.dids.carol, carolPost.uri)).toEqual(
        expect.objectContaining({
          reportCount: 0,
          appealCount: 0,
          escalateCount: 0,
        }),
      )
      expect(find(sc.dids.alice, alicePost.uri)).toEqual(
        expect.objectContaining({
          reportCount: 0,
          appealCount: 0,
          escalateCount: 0,
        }),
      )
      expect(find(sc.dids.carol, 'convo-a')?.reportCount).toBe(1)
      expect(find(sc.dids.carol, 'convo-b')?.reportCount).toBe(1)
      expect(find(sc.dids.carol, 'convo-legacy')?.reportCount).toBe(2)
      expect(stats.filter((r) => r.subjectDid === sc.dids.dan)).toEqual([])
      expect(stats.filter((r) => r.subjectKey === '')).toEqual([])
    })

    it('subtracts deleted events', async () => {
      const bobPost = postRef(sc.dids.bob, 0)
      const id = await findEventId(
        tools.ozone.moderation.defs.modEventReport.$type,
        bobPost.uri,
      )
      await db.db.deleteFrom('moderation_event').where('id', '=', id).execute()

      const stats = await expectParity()
      expect(stats.find((r) => r.subjectKey === bobPost.uri)?.reportCount).toBe(
        2,
      )
    })

    it('moves counts when an event is updated', async () => {
      const bobPost = postRef(sc.dids.bob, 0)
      const reportId = await findEventId(
        tools.ozone.moderation.defs.modEventReport.$type,
        bobPost.uri,
      )
      await sql`UPDATE moderation_event SET action = ${tools.ozone.moderation.defs.modEventEscalate.$type} WHERE id = ${reportId}`.execute(
        db.db,
      )
      let stats = await expectParity()
      expect(stats.find((r) => r.subjectKey === bobPost.uri)).toEqual(
        expect.objectContaining({ reportCount: 1, escalateCount: 1 }),
      )

      // Report to appeal
      const otherReportId = await findEventId(
        tools.ozone.moderation.defs.modEventReport.$type,
        bobPost.uri,
      )
      await sql`UPDATE moderation_event SET meta = jsonb_set(meta, '{reportType}', to_jsonb(${com.atproto.moderation.defs.reasonAppeal.value}::text)) WHERE id = ${otherReportId}`.execute(
        db.db,
      )
      stats = await expectParity()
      expect(stats.find((r) => r.subjectKey === bobPost.uri)).toEqual(
        expect.objectContaining({ reportCount: 0, appealCount: 3 }),
      )

      // To another subject, which gets a row
      const alicePost = postRef(sc.dids.alice, 1)
      await sql`UPDATE moderation_event SET "subjectDid" = ${sc.dids.alice}, "subjectUri" = ${alicePost.uri} WHERE id = ${reportId}`.execute(
        db.db,
      )
      stats = await expectParity()
      expect(stats.find((r) => r.subjectKey === alicePost.uri)).toEqual(
        expect.objectContaining({ escalateCount: 1 }),
      )

      // Touching a tracked column without changing it is a no-op
      await sql`UPDATE moderation_event SET action = action WHERE "subjectUri" = ${bobPost.uri}`.execute(
        db.db,
      )
      await expectParity()
    })

    it('backfills the table from moderation_event when migrating up', async () => {
      await db.transaction(async (txn) => {
        const migrationDb = txn.db as unknown as Kysely<any>
        await migration.down(migrationDb)
        expect(await relkind(txn, 'record_events_stats')).toBe('m')
        expect(await relkind(txn, 'record_events_stats_live')).toBeUndefined()
        expect(await recordStats(txn)).toEqual(await originalAggregate(txn))

        // Neither triggers nor the view see this one; only the backfill does
        await insertEvent(txn, {
          action: tools.ozone.moderation.defs.modEventReport.$type,
          subjectType: com.atproto.repo.strongRef.$type,
          subjectDid: sc.dids.dan,
          subjectUri: postRef(sc.dids.dan, 0).uri,
          meta: { reportType: ComAtprotoModerationDefs.REASONSPAM },
        })

        await migration.up(migrationDb)
        expect(await relkind(txn, 'record_events_stats')).toBe('v')
        expect(await relkind(txn, 'record_events_stats_live')).toBe('r')
        const expected = await originalAggregate(txn)
        expect(
          expected.find((r) => r.subjectDid === sc.dids.dan)?.reportCount,
        ).toBe(1)
        expect(await recordStats(txn)).toEqual(expected)
        // Built from the table at migration time
        expect(await accountStats(txn)).toEqual(accountStatsOf(expected))

        // The aggregate stays exact when restricted to id ranges, as a
        // chunked backfill would run it.
        const { rows: ids } = await sql<{
          min: number
          max: number
        }>`SELECT min(id) AS min, max(id) AS max FROM moderation_event`.execute(
          txn.db,
        )
        const { min, max } = ids[0]
        const mid = Math.floor((min + max) / 2)
        const chunked = new Map<string, RecordStats>()
        for (const [lo, hi] of [
          [min - 1, mid],
          [mid, max],
        ]) {
          const { rows } = await sql<RecordStats>`${sql.raw(
            migration.RECORD_STATS_AGGREGATE_SQL,
          )} AND id > ${lo} AND id <= ${hi} ${sql.raw(
            migration.RECORD_STATS_GROUP_BY_SQL,
          )}`.execute(txn.db)
          for (const row of rows) {
            const key = `${row.subjectDid} ${row.subjectKey}`
            const acc = chunked.get(key)
            chunked.set(
              key,
              acc
                ? {
                    ...acc,
                    escalateCount: acc.escalateCount + row.escalateCount,
                    reportCount: acc.reportCount + row.reportCount,
                    appealCount: acc.appealCount + row.appealCount,
                  }
                : row,
            )
          }
        }
        expect([...chunked.values()].sort(byDidAndKey)).toEqual(expected)
      })

      // Triggers are live again
      await sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: postRef(sc.dids.dan, 0),
      })
      const stats = await expectParity()
      expect(
        stats.find((r) => r.subjectKey === postRef(sc.dids.dan, 0).uri)
          ?.reportCount,
      ).toBe(2)
    })

    it('keeps a zero-count row when the last event of a subject is deleted', async () => {
      const bobPost = postRef(sc.dids.bob, 1)
      await db.db
        .deleteFrom('moderation_event')
        .where('subjectUri', '=', bobPost.uri)
        .execute()

      expect(
        (await originalAggregate(db)).find((r) => r.subjectKey === bobPost.uri),
      ).toBeUndefined()
      expect(
        (await recordStats(db)).find((r) => r.subjectKey === bobPost.uri),
      ).toEqual({
        subjectDid: sc.dids.bob,
        subjectKey: bobPost.uri,
        escalateCount: 0,
        reportCount: 0,
        appealCount: 0,
      })
    })
  })
})
