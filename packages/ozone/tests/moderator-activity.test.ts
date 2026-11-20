import { randomUUID } from 'node:crypto'
import type { Selectable } from 'kysely'
import { sql } from 'kysely'
import {
  type AtpAgent,
  type ToolsOzoneReportQueryModeratorActivity,
  ids,
} from '@atproto/api'
import {
  ADMIN_PASSWORD,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { asDatetimeString } from '@atproto/lex-schema'
import type { ModerationEvent } from '../src/db/schema/moderation_event.js'
import { tools } from '../src/lexicons/index.js'
import { queryModeratorActivity } from '../src/report/moderator-activity.js'
import { reportForEvent } from './_inbox.js'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

type Params = ToolsOzoneReportQueryModeratorActivity.QueryParams
type Row = ToolsOzoneReportQueryModeratorActivity.ActivityRow

describe('moderator activity history', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let reportId: number
  let template: Omit<Selectable<ModerationEvent>, 'id'>
  let params: Params
  let day = 0
  const ctx = () => network.ozone.ctx
  const db = () => ctx().db.db
  const query = async (
    overrides: Partial<Params> = {},
    role: 'admin' | 'moderator' | 'triage' = 'admin',
  ) =>
    (
      await agent.tools.ozone.report.queryModeratorActivity(
        { ...params, ...overrides },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneReportQueryModeratorActivity,
            role,
          ),
        },
      )
    ).data
  const event = async (createdAt = params.createdAfter, automated = false) =>
    db()
      .insertInto('moderation_event')
      .values({
        ...template,
        createdBy: sc.dids.alice,
        createdAt: asDatetimeString(createdAt),
        modTool: automated
          ? { name: 'example-tool', meta: { isAutomated: true } }
          : null,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  const activityValues = (createdAt = params.createdAfter) => ({
    reportId,
    activityType: 'noteActivity',
    previousStatus: null,
    internalNote: 'Private review note',
    publicNote: null,
    meta: null,
    createdBy: sc.dids.alice,
    createdAt: asDatetimeString(createdAt),
    isAutomated: false,
  })
  const activity = (createdAt = params.createdAfter) =>
    db()
      .insertInto('report_activity')
      .values(activityValues(createdAt))
      .returning('id')
      .executeTakeFirstOrThrow()
  const identity = (r: Row) => `${r.source}:${r.id}`

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: `moderator_activity_${randomUUID().replace(/[^a-f]/g, '')}`,
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    const reported = await sc.createReport({
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.bob },
      reportedBy: sc.dids.alice,
      reasonType: 'com.atproto.moderation.defs#reasonSpam',
    })
    await network.processAll()
    reportId = (await reportForEvent(network.ozone.getModClient(), reported.id))
      .id
    const original = await db()
      .selectFrom('moderation_event')
      .selectAll()
      .where('id', '=', reported.id)
      .executeTakeFirstOrThrow()
    const { id: _id, ...rest } = original
    template = {
      ...rest,
      action: tools.ozone.moderation.defs.modEventComment.$type,
      comment: 'Example review',
    }
  })
  beforeEach(() => {
    day += 2
    // @NOTE Each test owns a separate interval even when the local database is retained.
    const year = 2026
    params = {
      moderator: sc.dids.alice,
      createdAfter: `${year}-01-${String(day).padStart(2, '0')}T00:00:00.000Z`,
      createdBefore: `${year}-01-${String(day + 1).padStart(2, '0')}T00:00:00.000Z`,
      limit: 50,
    }
  })
  afterAll(async () => network?.close())

  it('allows admin JWT and basic credentials and denies other roles', async () => {
    const e = await event()
    const a = await activity()
    const expected = [`event:${e.id}`, `activity:${a.id}`]
    expect((await query()).rows.map(identity)).toEqual(expected)
    const basic = await agent.tools.ozone.report.queryModeratorActivity(
      params,
      {
        headers: {
          authorization: `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64')}`,
        },
      },
    )
    expect(basic.data.rows.map(identity)).toEqual(expected)
    for (const role of ['moderator', 'triage'] as const) {
      await expect(query({}, role)).rejects.toThrow('Unauthorized')
    }
    const setTriageRole = async (role: string) =>
      agent.tools.ozone.team.updateMember(
        { did: network.ozone.triageAccnt.did, role },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneTeamUpdateMember,
            'admin',
          ),
        },
      )
    await setTriageRole(tools.ozone.team.defs.RoleVerifier)
    try {
      await expect(query({}, 'triage')).rejects.toThrow('Unauthorized')
    } finally {
      await setTriageRole(tools.ozone.team.defs.RoleTriage)
    }
    await expect(
      agent.tools.ozone.report.queryModeratorActivity(params),
    ).rejects.toThrow('missing jwt')
  })

  it('interleaves tied timestamps with stable identities and no read effects', async () => {
    const e = await event()
    const a = await activity()
    const a2 = await activity()
    const counts = () =>
      sql`SELECT
      (SELECT count(*) FROM report_activity) AS activities,
      (SELECT count(*) FROM moderation_event) AS events,
      (SELECT count(*) FROM moderator_assignment) AS assignments`.execute(db())
    const before = (await counts()).rows
    const initial = await query({ limit: 1 })
    const seen = [...initial.rows]
    let cursor = initial.cursor
    while (cursor) {
      const next = await query({ limit: 1, cursor })
      seen.push(...next.rows)
      cursor = next.cursor
    }
    expect(seen.map(identity)).toEqual([
      `event:${e.id}`,
      `activity:${a2.id}`,
      `activity:${a.id}`,
    ])
    expect((await query()).rows.map(identity)).toEqual(seen.map(identity))
    expect(seen[0].createdBy).toBe(sc.dids.alice)
    expect(seen[1].activity?.internalNote).toBe('Private review note')
    expect((await counts()).rows).toEqual(before)
  })

  it('filters human activity, UTC bounds, actor and types before pagination', async () => {
    const human = await event()
    await event(params.createdAfter, true)
    const a = await activity()
    await db()
      .insertInto('report_activity')
      .values({ ...activityValues(), isAutomated: true })
      .execute()
    await db()
      .insertInto('report_activity')
      .values({ ...activityValues(), createdBy: sc.dids.bob })
      .execute()
    await event(params.createdBefore)
    await activity(params.createdBefore)
    expect(
      (await query({ types: [template.action], limit: 1 })).rows.map(identity),
    ).toEqual([`event:${human.id}`])
    expect(
      (await query({ types: ['noteActivity'], limit: 1 })).rows.map(identity),
    ).toEqual([`activity:${a.id}`])
    expect((await query()).rows.map(identity)).toEqual([
      `event:${human.id}`,
      `activity:${a.id}`,
    ])
    await expect(query({ createdBefore: params.createdAfter })).rejects.toThrow(
      'Activity start must precede end',
    )
    await expect(query({ createdAfter: 'bad-date' })).rejects.toThrow()
  })

  it('includes restricted-queue activity and private details for admins', async () => {
    const { data } = await agent.tools.ozone.queue.createQueue(
      {
        name: `Restricted ${day}`,
        subjectTypes: ['record'],
        reportTypes: [],
        strictAccess: true,
      },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneQueueCreateQueue,
          'admin',
        ),
      },
    )
    try {
      const a = await activity()
      const e = await event()
      await db()
        .updateTable('report_activity')
        .set({ meta: { actionEventId: e.id } })
        .where('id', '=', a.id)
        .execute()
      await db()
        .updateTable('report')
        .set({ queueId: data.queue.id })
        .where('id', '=', reportId)
        .execute()
      const rows = (await query()).rows
      expect(rows.map(identity)).toEqual([`event:${e.id}`, `activity:${a.id}`])
      expect(rows[0].event?.id).toBe(e.id)
      expect(rows[1].activity?.internalNote).toBe('Private review note')
      expect(rows[1].activity?.meta?.actionEventId).toBe(e.id)
      expect(rows[1].actionEventId).toBe(e.id)
    } finally {
      await db()
        .updateTable('report')
        .set({ queueId: -1 })
        .where('id', '=', reportId)
        .execute()
      await agent.tools.ozone.queue.deleteQueue(
        { queueId: data.queue.id },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneQueueDeleteQueue,
            'admin',
          ),
        },
      )
    }
  })

  it('rejects malformed ordering cursors and reapplies permissions for continuations', async () => {
    await activity()
    await event()
    const initial = await query({ limit: 1 })
    for (const cursor of [
      'xxx',
      Buffer.from(
        JSON.stringify({
          createdAt: params.createdAfter,
          source: 'unknown',
          id: 1,
        }),
      ).toString('base64url'),
      Buffer.from(
        JSON.stringify({ createdAt: 'invalid', source: 'event', id: 1 }),
      ).toString('base64url'),
    ]) {
      await expect(query({ cursor })).rejects.toThrow('Invalid activity cursor')
    }
    await expect(
      query({ cursor: initial.cursor }, 'moderator'),
    ).rejects.toThrow('Unauthorized')
  })

  it('preserves submillisecond ordering and refreshes with an ordinary first-page request', async () => {
    const first = await event(
      params.createdAfter.replace('00:00:00.000Z', '01:00:00.123001Z'),
    )
    const second = await activity(
      params.createdAfter.replace('00:00:00.000Z', '01:00:00.123002Z'),
    )
    const initial = await query({ limit: 1 })
    expect(initial.rows.map(identity)).toEqual([`activity:${second.id}`])
    expect(
      (await query({ limit: 1, cursor: initial.cursor })).rows.map(identity),
    ).toEqual([`event:${first.id}`])
    const latest = await activity(
      params.createdAfter.replace('00:00:00', '02:00:00'),
    )
    expect((await query({ limit: 1 })).rows.map(identity)).toEqual([
      `activity:${latest.id}`,
    ])
  })

  it('preserves distinct closure and action authors', async () => {
    const e = await event()
    const a = await db()
      .insertInto('report_activity')
      .values({
        ...activityValues(),
        createdBy: sc.dids.bob,
        activityType: 'closeActivity',
        previousStatus: 'open',
        meta: { resolution: 'linked', actionEventId: e.id },
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    const actionRows = (await query()).rows
    const closerRows = (await query({ moderator: sc.dids.bob })).rows
    expect(actionRows.map(identity)).toEqual([`event:${e.id}`])
    expect(closerRows.map(identity)).toEqual([`activity:${a.id}`])
    expect(closerRows[0].createdBy).toBe(sc.dids.bob)
    expect(closerRows[0].actionEventId).toBe(e.id)
  })

  it('cancels a blocked listing query without waiting for its table lock', async () => {
    const locked = deferred<void>()
    const release = deferred<void>()
    const holder = db()
      .transaction()
      .execute(async (tx) => {
        await sql`LOCK TABLE report_activity IN ACCESS EXCLUSIVE MODE`.execute(
          tx,
        )
        locked.resolve()
        await release.promise
      })
    await locked.promise
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const request = queryModeratorActivity(
        ctx(),
        tools.ozone.report.queryModeratorActivity.$params.parse(params),
        controller.signal,
      )
      await new Promise((resolve) => setTimeout(resolve, 100))
      controller.abort()
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Listing did not cancel')),
          2000,
        )
      })
      await expect(Promise.race([request, deadline])).rejects.not.toThrow(
        'Listing did not cancel',
      )
    } finally {
      if (timeout) clearTimeout(timeout)
      release.resolve()
      await holder
    }
  })
})
