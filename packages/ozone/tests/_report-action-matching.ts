import {
  type ToolsOzoneModerationDefs,
  type ToolsOzoneReportDefs,
  ids,
} from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { com, tools } from '../src/lexicons/index.js'
import { createReports, pooled } from './_inbox.js'

export const takedown = () =>
  tools.ozone.moderation.defs.modEventTakedown.$build({})

export const label = () =>
  tools.ozone.moderation.defs.modEventLabel.$build({
    createLabelVals: ['spam'],
    negateLabelVals: [],
  })

/** Boot a network for a report action matching suite and expose its shared helpers. */
export function setupReportActionMatching(dbPostgresSchema: string) {
  let network: TestNetwork
  let sc: SeedClient
  let mod: ModeratorClient
  let fixtureNumber = 0

  beforeAll(async () => {
    network = await TestNetwork.create({ dbPostgresSchema })
    sc = network.getSeedClient()
    mod = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => network?.close())

  const fixture = pooled(createFixture, () => network.processAll())

  async function createFixture() {
    const name = `matching${++fixtureNumber}`
    const { did } = await sc.createAccount(name, {
      handle: `${name}.test`,
      email: `${name}@example.com`,
      password: 'password',
    })
    const post = await sc.post(did, 'Example post')
    return {
      did,
      account: com.atproto.admin.defs.repoRef.$build({ did }),
      record: com.atproto.repo.strongRef.$build({
        uri: post.ref.uriStr,
        cid: post.ref.cidStr,
      }),
    }
  }

  type Fixture = Awaited<ReturnType<typeof createFixture>>
  type Subject = Fixture['account' | 'record']

  /** File reports from bob in order; subjects without a reason are spam. */
  async function reports(
    inputs: (Subject | { subject: Subject; reasonType: string })[],
  ) {
    return createReports(
      network,
      sc,
      inputs.map((input) => ({
        reasonType: com.atproto.moderation.defs.ReasonSpam,
        reportedBy: sc.dids.bob,
        ...('subject' in input ? input : { subject: input }),
      })),
    )
  }

  async function report(
    subject: Subject,
    reasonType: string = com.atproto.moderation.defs.ReasonSpam,
  ) {
    const [row] = await reports([{ subject, reasonType }])
    return row
  }

  async function getReport(id: number): Promise<
    Omit<ToolsOzoneReportDefs.ReportView, 'actionEventIds'> & {
      actionEventIds: number[] | null
    }
  > {
    const { data } = await mod.agent.tools.ozone.report.getReport(
      { id },
      {
        headers: await network.ozone.modHeaders(ids.ToolsOzoneReportGetReport),
      },
    )
    return { ...data, actionEventIds: data.actionEventIds ?? null }
  }

  async function activities(reportId?: number) {
    if (reportId !== undefined) {
      const { data } = await mod.agent.tools.ozone.report.listActivities(
        { reportId },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneReportListActivities,
          ),
        },
      )
      return data.activities.map(({ id }) => id)
    }
    const { data } = await mod.agent.tools.ozone.report.queryActivities(
      { limit: 100 },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportQueryActivities,
        ),
      },
    )
    return data.activities.map(({ id }) => id)
  }

  async function state(
    f: Fixture,
    kind: 'account' | 'record',
  ): Promise<
    | ToolsOzoneModerationDefs.RepoViewDetail
    | ToolsOzoneModerationDefs.RecordViewDetail
  > {
    if (kind === 'account') {
      return (
        await mod.agent.tools.ozone.moderation.getRepo(
          { did: f.did },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneModerationGetRepo,
            ),
          },
        )
      ).data
    }
    return (
      await mod.agent.tools.ozone.moderation.getRecord(
        { uri: f.record.uri },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneModerationGetRecord,
          ),
        },
      )
    ).data
  }

  async function setStatus(
    reportId: number,
    status: 'queued' | 'assigned' | 'escalated',
  ) {
    if (status === 'assigned') {
      await mod.agent.tools.ozone.report.assignModerator(
        {
          reportId,
          did: network.ozone.moderatorAccnt.did,
          isPermanent: true,
        },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneReportAssignModerator,
            'admin',
          ),
        },
      )
    } else {
      await mod.agent.tools.ozone.report.createActivity(
        {
          reportId,
          activity:
            status === 'queued'
              ? tools.ozone.report.defs.queueActivity.$build({})
              : tools.ozone.report.defs.escalationActivity.$build({}),
        },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneReportCreateActivity,
          ),
        },
      )
    }
  }

  return {
    get network() {
      return network
    },
    get mod() {
      return mod
    },
    fixture,
    reports,
    report,
    getReport,
    activities,
    state,
    setStatus,
  }
}
