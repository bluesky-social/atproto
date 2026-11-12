import { jest } from '@jest/globals'
import type { CompiledQuery, Kysely } from 'kysely'
import { sql } from 'kysely'
import type { AtpAgent } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'
import {
  down,
  up,
} from '../src/db/migrations/20261026T154047943Z-add-report-activity-member-created-index.js'
import { com, tools } from '../src/lexicons/index.js'

describe('online team members', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let sequence = 0

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_online_members',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  beforeEach(async () => {
    network.ozone.ctx.cfg.onlineMembers = {
      excludedDids: [],
      activeWindowMs: 5 * 60 * 1000,
    }
    // @NOTE the activity histories have no deletion endpoints for fixture reset.
    const db = network.ozone.ctx.db.db
    await db.deleteFrom('report_activity').execute()
    await db.deleteFrom('report').execute()
    await db.deleteFrom('moderation_event').execute()
  })

  afterAll(async () => {
    await network?.close()
  })

  async function online(
    params: { limit?: number } = {},
    role: 'admin' | 'moderator' | 'triage' = 'admin',
  ) {
    const { data } = await agent.tools.ozone.team.listOnlineMembers(params, {
      headers: await network.ozone.modHeaders(
        tools.ozone.team.listOnlineMembers.$lxm,
        role,
      ),
    })
    return data
  }

  async function member() {
    const did: DidString = `did:example:online${++sequence}`
    await agent.tools.ozone.team.addMember(
      { did, role: tools.ozone.team.defs.RoleModerator },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          tools.ozone.team.addMember.$lxm,
          'admin',
        ),
      },
    )
    return did
  }

  // @NOTE historical timestamps cannot be supplied through activity APIs.
  async function event(did: DidString, createdAt: number) {
    await network.ozone.ctx.db.db
      .insertInto('moderation_event')
      .values({
        action: tools.ozone.moderation.defs.modEventComment.$type,
        subjectType: com.atproto.admin.defs.repoRef.$type,
        subjectDid: sc.dids.alice,
        createdBy: did,
        createdAt: toDatetimeString(createdAt),
        comment: 'Private event text',
      })
      .execute()
  }

  async function activity(
    did: DidString,
    createdAt: number,
    isAutomated = false,
  ) {
    await network.ozone.ctx.db.db
      .insertInto('report_activity')
      .values({
        reportId: 1,
        activityType: 'closeActivity',
        isAutomated,
        createdBy: did,
        createdAt: toDatetimeString(createdAt),
        internalNote: 'Private report text',
      })
      .execute()
  }

  it('returns an empty list when no members have recent activity', async () => {
    expect(await online()).toEqual({ members: [] })
  })

  it('combines both sources, deduplicates members, and returns only presence fields', async () => {
    const eventOnly = await member()
    const activityOnly = await member()
    const both = await member()
    const now = Date.now()
    await event(eventOnly, now - 3000)
    await activity(activityOnly, now - 2000)
    await event(both, now - 4000)
    await activity(both, now - 1000)

    expect(await online()).toEqual({
      members: [
        { did: both, lastActive: toDatetimeString(now - 1000) },
        { did: activityOnly, lastActive: toDatetimeString(now - 2000) },
        { did: eventOnly, lastActive: toDatetimeString(now - 3000) },
      ],
    })

    await event(both, now)
    expect((await online()).members[0]).toEqual({
      did: both,
      lastActive: toDatetimeString(now),
    })
  })

  it.each(['single', 'bulk'] as const)(
    'includes a member who only closes reports as no-action through the %s API',
    async (mode) => {
      await sc.createReport({
        reasonType: com.atproto.moderation.defs.ReasonSpam,
        subject: {
          $type: com.atproto.admin.defs.repoRef.$type,
          did: sc.dids.alice,
        },
        reportedBy: sc.dids.bob,
      })
      await network.processAll()
      const headers = async (lxm: string) =>
        network.ozone.modHeaders(lxm, 'moderator')
      if (mode === 'single') {
        const { data } = await agent.tools.ozone.report.queryReports(
          { subject: sc.dids.alice, status: 'open' },
          { headers: await headers(tools.ozone.report.queryReports.$lxm) },
        )
        await agent.tools.ozone.report.createActivity(
          {
            reportId: data.reports[0].id,
            activity: { $type: tools.ozone.report.defs.closeActivity.$type },
          },
          {
            encoding: 'application/json',
            headers: await headers(tools.ozone.report.createActivity.$lxm),
          },
        )
      } else {
        const { data } = await agent.tools.ozone.report.closeReports(
          { subject: sc.dids.alice },
          {
            encoding: 'application/json',
            headers: await headers(tools.ozone.report.closeReports.$lxm),
          },
        )
        expect(data.closedCount).toBe(1)
      }

      const did = network.ozone.moderatorAccnt.did
      expect((await online()).members.map((m) => m.did)).toEqual([did])
      const { data } = await agent.tools.ozone.moderation.queryEvents(
        { createdBy: did },
        { headers: await headers(tools.ozone.moderation.queryEvents.$lxm) },
      )
      expect(data.events).toEqual([])
    },
  )

  it('ignores automated report activity without hiding older human activity', async () => {
    const human = await member()
    const automated = await member()
    const now = Date.now()
    await activity(human, now - 2000)
    await activity(human, now - 1000, true)
    await activity(automated, now - 1000, true)
    expect(await online()).toEqual({
      members: [{ did: human, lastActive: toDatetimeString(now - 2000) }],
    })
  })

  it('excludes disabled, deleted, nonmember, and service DIDs from both sources', async () => {
    const disabled = await member()
    const deleted = await member()
    const serviceDid = network.ozone.ctx.cfg.service.did
    await agent.tools.ozone.team.updateMember(
      { did: disabled, disabled: true },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          tools.ozone.team.updateMember.$lxm,
          'admin',
        ),
      },
    )
    await agent.tools.ozone.team.deleteMember(
      { did: deleted },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          tools.ozone.team.deleteMember.$lxm,
          'admin',
        ),
      },
    )
    for (const did of [disabled, deleted, sc.dids.bob, serviceDid]) {
      await event(did, Date.now() - 1000)
      await activity(did, Date.now() - 1000)
    }
    expect(await online()).toEqual({ members: [] })
  })

  it('applies server exclusions to both sources before the user limit', async () => {
    const excludedEvent = await member()
    const excludedActivity = await member()
    const included = await member()
    await event(included, Date.now() - 2000)
    await event(excludedEvent, Date.now() - 1000)
    await activity(excludedActivity, Date.now() - 1000)
    network.ozone.ctx.cfg.onlineMembers.excludedDids = [
      excludedEvent,
      excludedActivity,
      excludedEvent,
    ]
    expect((await online({ limit: 1 })).members.map((m) => m.did)).toEqual([
      included,
    ])
    expect((await online()).members.map((m) => m.did)).toEqual([included])
  })

  it.each(['event', 'activity'] as const)(
    'includes exact time bounds and ignores old and future %s records',
    async (source) => {
      const lower = await member()
      const upper = await member()
      const old = await member()
      const future = await member()
      const now = Date.now()
      const seed = source === 'event' ? event : activity
      await seed(lower, now - 5 * 60 * 1000)
      await seed(upper, now)
      await seed(old, now - 5 * 60 * 1000 - 1)
      await seed(future, now + 1)
      using _clock = jest.spyOn(Date, 'now').mockReturnValue(now)
      expect((await online()).members.map((m) => m.did)).toEqual([upper, lower])
    },
  )

  it.each([
    ['event', 60 * 1000],
    ['activity', 60 * 1000],
    ['event', 10 * 60 * 1000],
    ['activity', 10 * 60 * 1000],
  ] as const)(
    'applies the configured %s activity window of %i ms',
    async (source, activeWindowMs) => {
      network.ozone.ctx.cfg.onlineMembers.activeWindowMs = activeWindowMs
      const lower = await member()
      const old = await member()
      const now = Date.now()
      const seed = source === 'event' ? event : activity
      await seed(lower, now - activeWindowMs)
      await seed(old, now - activeWindowMs - 1)
      using _clock = jest.spyOn(Date, 'now').mockReturnValue(now)
      expect(await online()).toEqual({
        members: [
          { did: lower, lastActive: toDatetimeString(now - activeWindowMs) },
        ],
      })
    },
  )

  it('orders timestamp ties by DID and does not let event volume crowd out users', async () => {
    const first = await member()
    const second = await member()
    const time = Date.now() - 1000
    for (let i = 0; i < 35; i++) await event(first, time)
    await activity(second, time)
    expect((await online()).members.map((m) => m.did)).toEqual(
      [first, second].sort(),
    )
  })

  it.each(['admin', 'moderator', 'triage'] as const)(
    'allows %s access',
    async (role) => {
      expect(await online({}, role)).toEqual({ members: [] })
    },
  )

  it('requires moderator authentication', async () => {
    const response = await fetch(
      `${network.ozone.url}/xrpc/${tools.ozone.team.listOnlineMembers.$lxm}`,
    )
    expect(response.status).toBe(401)
    await response.json()
  })

  it.each(['limit=0', 'limit=101'])(
    'rejects invalid parameters: %s',
    async (params) => {
      const response = await fetch(
        `${network.ozone.url}/xrpc/${tools.ozone.team.listOnlineMembers.$lxm}?${params}`,
        {
          headers: await network.ozone.modHeaders(
            tools.ozone.team.listOnlineMembers.$lxm,
          ),
        },
      )
      expect(response.status).toBe(400)
      await response.json()
    },
  )

  it('uses creator/time indexes with one-row lateral limits', async () => {
    const did = await member()
    await event(did, Date.now() - 1000)
    await activity(did, Date.now() - 1000)
    let query: CompiledQuery<unknown> | undefined
    {
      using queries = jest.spyOn(
        network.ozone.ctx.db.db.getExecutor(),
        'executeQuery',
      )
      await online()
      query = queries.mock.calls
        .map(([compiled]) => compiled)
        .find((compiled) => compiled.sql.includes('greatest(event.'))
    }
    if (!query) throw new Error('Online-member query not captured')
    const compiled = query
    type PlanNode = {
      'Node Type': string
      'Index Name'?: string
      'Index Cond'?: string
      'Actual Rows': number
      Plans?: PlanNode[]
    }
    const plan = await network.ozone.ctx.db.transaction(async (txn) => {
      // @NOTE small fixtures favor scans; verify index eligibility separately.
      await sql`SET LOCAL enable_seqscan = off`.execute(txn.db)
      const { rows } = await txn.db.executeQuery<{
        'QUERY PLAN': { Plan: PlanNode }[]
      }>({
        ...compiled,
        sql: `EXPLAIN (ANALYZE, FORMAT JSON) ${compiled.sql}`,
      })
      return rows[0]['QUERY PLAN'][0].Plan
    })
    function nodes(node: PlanNode): PlanNode[] {
      return [node, ...(node.Plans ?? []).flatMap(nodes)]
    }
    const all = nodes(plan)
    for (const index of [
      'moderation_event_created_by_idx',
      'report_activity_member_created_idx',
    ]) {
      const scan = all.find((node) => node['Index Name'] === index)
      expect(scan?.['Index Cond']).toContain('createdBy')
      expect(scan?.['Index Cond']).toContain('createdAt')
    }
    expect(
      all.filter(
        (node) => node['Node Type'] === 'Limit' && node['Actual Rows'] <= 1,
      ).length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('creates a valid partial index and supports migration reruns and rollback', async () => {
    const db = network.ozone.ctx.db
    await db.transaction(async (txn) => {
      const migrationDb = txn.db as unknown as Kysely<unknown>
      await down(migrationDb)
      await down(migrationDb)
      await up(migrationDb)
      await up(migrationDb)
      const { rows } = await sql<{
        valid: boolean
        ready: boolean
        definition: string
      }>`
        SELECT indisvalid AS valid, indisready AS ready,
          pg_get_indexdef(indexrelid) AS definition
        FROM pg_index
        WHERE indexrelid = to_regclass(${`${db.schema}.report_activity_member_created_idx`})
      `.execute(txn.db)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ valid: true, ready: true })
      expect(rows[0].definition).toContain('("createdBy", "createdAt", id)')
      expect(rows[0].definition).toContain('WHERE ("isAutomated" = false)')
    })
  })
})
