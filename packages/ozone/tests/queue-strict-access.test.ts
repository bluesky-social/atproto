import { type Kysely, sql } from 'kysely'
import { type AtpAgent, ComAtprotoModerationDefs, ids } from '@atproto/api'
import {
  ADMIN_PASSWORD,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { toDatetimeString } from '@atproto/lex'
import { Database } from '../src/db/index.js'
import {
  down,
  up,
} from '../src/db/migrations/20261020T000000000Z-add-queue-strict-access.js'
import { reportForEvent } from './_inbox.js'

type Role = 'admin' | 'moderator' | 'triage'

describe('strict queue access', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let ordinary: number
  let strict: number
  let sequence = 0
  const queues: number[] = []

  const options = async (nsid: string, role: Role = 'admin') => ({
    headers: await network.ozone.modHeaders(nsid, role),
  })

  async function createQueue(strictAccess = false, role: Role = 'admin') {
    const { data } = await agent.tools.ozone.queue.createQueue(
      {
        name: `Queue ${++sequence}`,
        subjectTypes: ['account'],
        reportTypes: [],
        strictAccess,
      },
      await options(ids.ToolsOzoneQueueCreateQueue, role),
    )
    queues.push(data.queue.id)
    return data.queue.id
  }

  async function listQueues(
    role: Role = 'moderator',
    cursor?: string,
    limit = 100,
  ) {
    return (
      await agent.tools.ozone.queue.listQueues(
        { limit, cursor },
        await options(ids.ToolsOzoneQueueListQueues, role),
      )
    ).data
  }

  async function grant(queueId = strict, role: Role = 'moderator') {
    const did =
      role === 'admin'
        ? network.ozone.adminAccnt.did
        : role === 'moderator'
          ? network.ozone.moderatorAccnt.did
          : network.ozone.triageAccnt.did
    return agent.tools.ozone.queue.assignModerator(
      { queueId, did },
      await options(ids.ToolsOzoneQueueAssignModerator),
    )
  }

  async function report(queueId = strict) {
    const event = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      reason: 'Report details',
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
    const result = await reportForEvent(network.ozone.getModClient(), event.id)
    if (queueId !== -1) {
      await agent.tools.ozone.report.reassignQueue(
        { reportId: result.id, queueId },
        await options(ids.ToolsOzoneReportReassignQueue),
      )
    }
    return { ...result, eventId: event.id }
  }

  const getReport = async (id: number, role: Role = 'moderator') =>
    (
      await agent.tools.ozone.report.getReport(
        { id },
        await options(ids.ToolsOzoneReportGetReport, role),
      )
    ).data

  const queryQueue = (queueId: number, role: Role = 'moderator') =>
    options(ids.ToolsOzoneReportQueryReports, role).then((opts) =>
      agent.tools.ozone.report.queryReports(
        { queueId, status: 'queued' },
        opts,
      ),
    )

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_queue_strict_access',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  beforeEach(async () => {
    ordinary = await createQueue()
    strict = await createQueue(true)
  })

  afterEach(async () => {
    for (const queueId of queues.splice(0)) {
      // @NOTE A test can already have soft-deleted a queue.
      const all = await listQueues('admin')
      if (all.queues.some((queue) => queue.id === queueId)) {
        await agent.tools.ozone.queue.deleteQueue(
          { queueId },
          await options(ids.ToolsOzoneQueueDeleteQueue),
        )
      }
    }
  })

  afterAll(async () => network?.close())

  it('defaults existing queues to unrestricted access and supports schema rollback', async () => {
    const schema = 'queue_strict_migration_fixture'
    const db = new Database({ ...network.ozone.ctx.db.opts, schema })
    const migrationDb = db.db as unknown as Kysely<unknown>
    try {
      await db.db.schema.createSchema(schema).execute()
      await db.db.schema
        .createTable('report_queue')
        .addColumn('id', 'integer', (col) => col.primaryKey())
        .execute()
      await sql`INSERT INTO report_queue (id) VALUES (1)`.execute(db.db)
      await up(migrationDb)
      expect(
        await db.db.selectFrom('report_queue').select('strictAccess').execute(),
      ).toEqual([{ strictAccess: false }])
      const { rows } = await sql<{
        is_nullable: string
        column_default: string
      }>`SELECT is_nullable, column_default FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = 'report_queue' AND column_name = 'strictAccess'`.execute(
        db.db,
      )
      expect(rows).toEqual([{ is_nullable: 'NO', column_default: 'false' }])
      await down(migrationDb)
      const tables = await db.db.introspection.getTables()
      expect(
        tables
          .find(
            (table) => table.schema === schema && table.name === 'report_queue',
          )
          ?.columns.map((column) => column.name),
      ).toEqual(['id'])
      await up(migrationDb)
      expect(
        await db.db.selectFrom('report_queue').select('strictAccess').execute(),
      ).toEqual([{ strictAccess: false }])
    } finally {
      await db.db.schema.dropSchema(schema).cascade().execute()
      await db.close()
    }
  })

  it.each<Role>(['admin', 'moderator', 'triage'])(
    'applies visibility without elevating the %s role',
    async (role) => {
      let visible = (await listQueues(role)).queues.map((queue) => queue.id)
      expect(visible).toContain(ordinary)
      expect(visible.includes(strict)).toBe(role === 'admin')
      if (role !== 'admin')
        await expect(queryQueue(strict, role)).rejects.toMatchObject({
          error: 'QueueNotFound',
        })
      await grant(strict, role)
      visible = (await listQueues(role)).queues.map((queue) => queue.id)
      expect(visible).toContain(strict)
      expect((await queryQueue(strict, role)).data.reports).toEqual([])
      if (role === 'triage') {
        await expect(
          agent.tools.ozone.queue.updateQueue(
            { queueId: strict, description: 'Changed' },
            await options(ids.ToolsOzoneQueueUpdateQueue, role),
          ),
        ).rejects.toThrow('Must be a moderator')
      }
    },
  )

  it('preserves defaults, omitted updates, and admin-token visibility', async () => {
    const { data } = await agent.tools.ozone.queue.createQueue(
      { name: `Default ${++sequence}` },
      await options(ids.ToolsOzoneQueueCreateQueue, 'moderator'),
    )
    queues.push(data.queue.id)
    expect(data.queue.strictAccess).toBe(false)
    const updated = await agent.tools.ozone.queue.updateQueue(
      { queueId: strict, description: 'Metadata' },
      await options(ids.ToolsOzoneQueueUpdateQueue),
    )
    expect(updated.data.queue.strictAccess).toBe(true)
    const response = await fetch(
      `${network.ozone.url}/xrpc/${ids.ToolsOzoneQueueListQueues}`,
      {
        headers: {
          authorization: `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64')}`,
        },
      },
    )
    expect(response.status).toBe(200)
    expect(
      (await response.json()).queues.map((queue: { id: number }) => queue.id),
    ).toContain(strict)
    const reportsResponse = await fetch(
      `${network.ozone.url}/xrpc/${ids.ToolsOzoneReportQueryReports}?queueId=${strict}&status=queued`,
      {
        headers: {
          authorization: `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64')}`,
        },
      },
    )
    expect(reportsResponse.status).toBe(200)
    await expect(
      agent.tools.ozone.queue.updateQueue(
        { queueId: ordinary, strictAccess: null as unknown as boolean },
        await options(ids.ToolsOzoneQueueUpdateQueue),
      ),
    ).rejects.toThrow()
  })

  it('restricts strict configuration and membership grants to admins', async () => {
    await expect(createQueue(true, 'moderator')).rejects.toThrow('Only admins')
    await expect(
      agent.tools.ozone.queue.updateQueue(
        { queueId: ordinary, strictAccess: true },
        await options(ids.ToolsOzoneQueueUpdateQueue, 'moderator'),
      ),
    ).rejects.toThrow('Only admins')
    await expect(
      agent.tools.ozone.queue.assignModerator(
        { queueId: strict, did: network.ozone.moderatorAccnt.did },
        await options(ids.ToolsOzoneQueueAssignModerator, 'moderator'),
      ),
    ).rejects.toThrow('Only admins')
    await grant()
    await expect(
      agent.tools.ozone.queue.assignModerator(
        { queueId: strict, did: network.ozone.moderatorAccnt.did },
        await options(ids.ToolsOzoneQueueAssignModerator, 'moderator'),
      ),
    ).rejects.toThrow('Only admins')
    await expect(
      agent.tools.ozone.queue.updateQueue(
        { queueId: strict, strictAccess: false },
        await options(ids.ToolsOzoneQueueUpdateQueue, 'moderator'),
      ),
    ).rejects.toThrow('Only admins')
    await agent.tools.ozone.queue.assignModerator(
      { queueId: ordinary, did: network.ozone.moderatorAccnt.did },
      await options(ids.ToolsOzoneQueueAssignModerator, 'moderator'),
    )
  })

  it('recognizes existing members when strict access is enabled', async () => {
    await grant(ordinary)
    await agent.tools.ozone.queue.updateQueue(
      { queueId: ordinary, strictAccess: true },
      await options(ids.ToolsOzoneQueueUpdateQueue),
    )
    expect((await listQueues()).queues.map((queue) => queue.id)).toContain(
      ordinary,
    )
    expect(
      (await listQueues('triage')).queues.map((queue) => queue.id),
    ).not.toContain(ordinary)
    await agent.tools.ozone.queue.updateQueue(
      { queueId: ordinary, strictAccess: false },
      await options(ids.ToolsOzoneQueueUpdateQueue),
    )
    expect(
      (await listQueues('triage')).queues.map((queue) => queue.id),
    ).toContain(ordinary)
  })

  it('revokes access on the next request when a member leaves', async () => {
    const hidden = await report()
    await grant()
    expect(
      (await queryQueue(strict)).data.reports.map((item) => item.id),
    ).toContain(hidden.id)
    await agent.tools.ozone.queue.unassignModerator(
      { queueId: strict, did: network.ozone.moderatorAccnt.did },
      await options(ids.ToolsOzoneQueueUnassignModerator, 'moderator'),
    )
    await expect(queryQueue(strict)).rejects.toMatchObject({
      error: 'QueueNotFound',
    })
    expect((await getReport(hidden.id)).id).toBe(hidden.id)
    expect((await listQueues()).queues.map((queue) => queue.id)).not.toContain(
      strict,
    )
  })

  it.each(['expired', 'future'] as const)(
    'does not grant visibility through %s membership',
    async (state) => {
      const did = network.ozone.moderatorAccnt.did
      // @NOTE The membership APIs do not expose scheduled or expiring grants.
      await network.ozone.ctx.db.db
        .insertInto('moderator_assignment')
        .values({
          did,
          queueId: strict,
          reportId: null,
          startAt: toDatetimeString(
            Date.now() + (state === 'future' ? 60_000 : -60_000),
          ),
          endAt:
            state === 'expired' ? toDatetimeString(Date.now() - 1_000) : null,
        })
        .execute()
      expect(
        (await listQueues()).queues.map((queue) => queue.id),
      ).not.toContain(strict)
      await expect(queryQueue(strict)).rejects.toMatchObject({
        error: 'QueueNotFound',
      })
    },
  )

  it('accepts active expiring membership and applies admin revocation', async () => {
    // @NOTE The membership API creates permanent assignments only.
    await network.ozone.ctx.db.db
      .insertInto('moderator_assignment')
      .values({
        did: network.ozone.moderatorAccnt.did,
        queueId: strict,
        reportId: null,
        startAt: toDatetimeString(Date.now() - 5_000),
        endAt: toDatetimeString(Date.now() + 60_000),
      })
      .execute()
    expect((await listQueues()).queues.map((queue) => queue.id)).toContain(
      strict,
    )
    expect((await queryQueue(strict)).data.reports).toEqual([])
    await agent.tools.ozone.queue.unassignModerator(
      { queueId: strict, did: network.ozone.moderatorAccnt.did },
      await options(ids.ToolsOzoneQueueUnassignModerator),
    )
    expect((await listQueues()).queues.map((queue) => queue.id)).not.toContain(
      strict,
    )
    await expect(queryQueue(strict)).rejects.toMatchObject({
      error: 'QueueNotFound',
    })
  })

  it('does not treat individual report assignments as queue membership', async () => {
    const hidden = await report()
    await agent.tools.ozone.report.assignModerator(
      {
        reportId: hidden.id,
        queueId: strict,
        did: network.ozone.moderatorAccnt.did,
      },
      await options(ids.ToolsOzoneReportAssignModerator),
    )
    await expect(queryQueue(strict)).rejects.toMatchObject({
      error: 'QueueNotFound',
    })
    expect((await getReport(hidden.id)).id).toBe(hidden.id)
    expect((await listQueues()).queues.map((queue) => queue.id)).not.toContain(
      strict,
    )
  })

  it('routes reports to strict queues independently of moderator membership', async () => {
    const unassigned = await report(-1)
    const { data } = await agent.tools.ozone.queue.createQueue(
      {
        name: `Automatic ${++sequence}`,
        subjectTypes: ['account'],
        reportTypes: [ComAtprotoModerationDefs.REASONSPAM],
        strictAccess: true,
      },
      await options(ids.ToolsOzoneQueueCreateQueue),
    )
    queues.push(data.queue.id)
    const routed = await agent.tools.ozone.queue.routeReports(
      { startReportId: unassigned.id, endReportId: unassigned.id },
      await options(ids.ToolsOzoneQueueRouteReports, 'moderator'),
    )
    expect(routed.data.assigned).toBe(1)
    expect((await getReport(unassigned.id, 'admin')).queue?.id).toBe(
      data.queue.id,
    )
    expect((await getReport(unassigned.id)).queue?.id).toBe(data.queue.id)
    await expect(queryQueue(data.queue.id)).rejects.toMatchObject({
      error: 'QueueNotFound',
    })
    const event = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      reportedBy: sc.dids.carol,
    })
    await network.processAll()
    const reports = await agent.tools.ozone.report.queryReports(
      { queueId: data.queue.id, status: 'queued' },
      await options(ids.ToolsOzoneReportQueryReports),
    )
    expect(reports.data.reports.map((item) => item.eventId)).toContain(event.id)
  })

  it('serializes self-assignment with a concurrent strict toggle', async () => {
    const db = network.ozone.ctx.db
    let unlock!: () => void
    let locked!: () => void
    const ready = new Promise<void>((resolve) => {
      locked = resolve
    })
    const release = new Promise<void>((resolve) => {
      unlock = resolve
    })
    const toggle = db.transaction(async (txn) => {
      // @NOTE Hold the real queue lock to exercise the competing API transaction.
      await txn.db
        .updateTable('report_queue')
        .set({ strictAccess: true })
        .where('id', '=', ordinary)
        .execute()
      locked()
      await release
    })
    await ready
    const assignment = agent.tools.ozone.queue.assignModerator(
      { queueId: ordinary, did: network.ozone.moderatorAccnt.did },
      await options(ids.ToolsOzoneQueueAssignModerator, 'moderator'),
    )
    const rejected = expect(assignment).rejects.toThrow('Only admins')
    try {
      let waiting = false
      for (let i = 0; i < 100 && !waiting; i++) {
        const result = await sql<{
          waiting: boolean
        }>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%report_queue%') AS waiting`.execute(
          db.db,
        )
        waiting = result.rows[0].waiting
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10))
      }
      expect(waiting).toBe(true)
    } finally {
      unlock()
      await toggle
      await rejected
    }
    expect((await listQueues()).queues.map((queue) => queue.id)).not.toContain(
      ordinary,
    )
  })

  it('keeps existing statistics available to an unassigned moderator', async () => {
    await report()
    const admin = await agent.tools.ozone.report.getLiveStats(
      {},
      await options(ids.ToolsOzoneReportGetLiveStats),
    )
    const moderator = await agent.tools.ozone.report.getLiveStats(
      {},
      await options(ids.ToolsOzoneReportGetLiveStats, 'moderator'),
    )
    expect(moderator.data).toEqual(admin.data)
  })

  it('filters the queue list before pagination', async () => {
    const next = await createQueue()
    const first = await listQueues('moderator', undefined, 1)
    const second = await listQueues('moderator', first.cursor, 1)
    expect(first.queues.map((queue) => queue.id)).toEqual([ordinary])
    expect(second.queues.map((queue) => queue.id)).toEqual([next])
  })

  it('blocks explicit strict queue queries while preserving other report and event access', async () => {
    const item = await report()
    await expect(queryQueue(strict)).rejects.toMatchObject({
      error: 'QueueNotFound',
    })
    expect(
      (await queryQueue(strict, 'admin')).data.reports.map(
        (report) => report.id,
      ),
    ).toContain(item.id)
    expect((await queryQueue(ordinary)).data.reports).toEqual([])
    expect(
      (await queryQueue(-1)).data.reports.map((report) => report.id),
    ).not.toContain(item.id)
    expect((await getReport(item.id)).id).toBe(item.id)
    const { data: reports } = await agent.tools.ozone.report.queryReports(
      { status: 'queued', subject: sc.dids.alice },
      await options(ids.ToolsOzoneReportQueryReports, 'moderator'),
    )
    expect(reports.reports.map((report) => report.id)).toContain(item.id)
    const { data: event } = await agent.tools.ozone.moderation.getEvent(
      { id: item.eventId },
      await options(ids.ToolsOzoneModerationGetEvent, 'moderator'),
    )
    expect(event.id).toBe(item.eventId)
    const { data: events } = await agent.tools.ozone.moderation.queryEvents(
      {
        subject: sc.dids.alice,
        types: ['tools.ozone.moderation.defs#modEventReport'],
      },
      await options(ids.ToolsOzoneModerationQueryEvents, 'moderator'),
    )
    expect(events.events.map((event) => event.id)).toContain(item.eventId)
    await grant()
    expect(
      (await queryQueue(strict)).data.reports.map((report) => report.id),
    ).toContain(item.id)
  })
})
