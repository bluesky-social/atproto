import { afterAll, beforeAll, expect } from 'vitest'
import {
  type ToolsOzoneInboxGetReport,
  type ToolsOzoneReportCloseReports,
  type ToolsOzoneReportDefs,
  ids,
} from '@atproto/api'
import type AtpAgent from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { chat, com, tools } from '../src/lexicons/index.js'
import {
  type ReportSubject,
  createReports,
  inboxHeaders,
  pooled,
} from './_inbox.js'

type ReportInput =
  ReportSubject | { subject: ReportSubject; reasonType: string }

/** Boot a network for a closeReports suite and expose its shared helpers. */
export function setupCloseReports(dbPostgresSchema: string) {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let fixtureNumber = 0

  beforeAll(async () => {
    network = await TestNetwork.create({ dbPostgresSchema })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  const modHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'admin')

  async function closeReports(input: {
    subject: string
    includeAllOwned?: boolean
    reportId?: number
    reportTypes?: string[]
    excludedReportTypes?: string[]
    actionEventId?: number
    internalNote?: string
    isAutomated?: boolean
    meta?: Record<string, unknown>
  }): Promise<ToolsOzoneReportCloseReports.Response> {
    return agent.tools.ozone.report.closeReports(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportCloseReports,
        'admin',
      ),
    })
  }

  async function listActivities(
    reportId: number,
  ): Promise<ToolsOzoneReportDefs.ReportActivityView[]> {
    const { data } = await agent.tools.ozone.report.listActivities(
      { reportId },
      { headers: await modHeaders(ids.ToolsOzoneReportListActivities) },
    )
    return data.activities
  }

  const fixture = pooled(createFixture, () => network.processAll())

  async function createFixture() {
    const name = `closereports${++fixtureNumber}`
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
      message: chat.bsky.convo.defs.messageRef.$build({
        did,
        convoId: 'example-conversation',
        messageId: 'example-message',
      }),
      conversation: chat.bsky.convo.defs.convoRef.$build({
        did,
        convoId: 'example-conversation',
      }),
    }
  }

  /** File reports from bob in order; subjects without a reason are spam. */
  async function reports(inputs: ReportInput[]) {
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
    subject: ReportSubject,
    reasonType: string = com.atproto.moderation.defs.ReasonSpam,
  ) {
    const [row] = await reports([{ subject, reasonType }])
    return row
  }

  async function detail(id: number): Promise<ToolsOzoneReportDefs.ReportView> {
    return (
      await agent.tools.ozone.report.getReport(
        { id },
        { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
      )
    ).data
  }

  async function reopen(reportId: number) {
    await agent.tools.ozone.report.createActivity(
      {
        reportId,
        activity: tools.ozone.report.defs.reopenActivity.$build({}),
      },
      { headers: await modHeaders(ids.ToolsOzoneReportCreateActivity) },
    )
  }

  async function inbox(
    reportId: number,
  ): Promise<ToolsOzoneInboxGetReport.OutputSchema> {
    return (
      await sc.agent.tools.ozone.inbox.getReport(
        { id: reportId },
        { headers: inboxHeaders(network, sc, sc.dids.bob) },
      )
    ).data
  }

  async function setStatus(
    reportId: number,
    status: 'queued' | 'assigned' | 'escalated',
  ) {
    if (status === 'assigned') {
      await agent.tools.ozone.report.assignModerator(
        {
          reportId,
          did: network.ozone.moderatorAccnt.did,
          isPermanent: true,
        },
        { headers: await modHeaders(ids.ToolsOzoneReportAssignModerator) },
      )
    } else {
      await agent.tools.ozone.report.createActivity(
        {
          reportId,
          activity:
            status === 'queued'
              ? tools.ozone.report.defs.queueActivity.$build({})
              : tools.ozone.report.defs.escalationActivity.$build({}),
        },
        { headers: await modHeaders(ids.ToolsOzoneReportCreateActivity) },
      )
    }
    expect((await detail(reportId)).status).toBe(status)
  }

  async function snapshotReports(reports: { id: number }[]) {
    const snapshots: {
      report: Awaited<ReturnType<typeof detail>>
      activities: Awaited<ReturnType<typeof listActivities>>
    }[] = []
    // @NOTE Avoid saturating the in-process AppView with concurrent fixture reads.
    for (const { id } of reports) {
      snapshots.push({
        report: await detail(id),
        activities: await listActivities(id),
      })
    }
    return snapshots
  }

  async function expectUnchanged(
    snapshots: Awaited<ReturnType<typeof snapshotReports>>,
  ) {
    for (const { report, activities } of snapshots) {
      const current = await detail(report.id)
      expect({
        status: current.status,
        updatedAt: current.updatedAt,
        actionEventIds: current.actionEventIds,
        actionNote: current.actionNote,
      }).toEqual({
        status: report.status,
        updatedAt: report.updatedAt,
        actionEventIds: report.actionEventIds,
        actionNote: report.actionNote,
      })
      expect(await listActivities(report.id)).toEqual(activities)
    }
  }

  return {
    get network() {
      return network
    },
    get agent() {
      return agent
    },
    get sc() {
      return sc
    },
    modHeaders,
    closeReports,
    listActivities,
    fixture,
    reports,
    report,
    detail,
    reopen,
    inbox,
    setStatus,
    snapshotReports,
    expectUnchanged,
  }
}
