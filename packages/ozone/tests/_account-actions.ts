import { type ToolsOzoneReportDefs, ids } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { chat, com, tools } from '../src/lexicons/index.js'
import { type ReportSubject, createReports, pooled } from './_inbox.js'

export type ReportSubjectTypes = NonNullable<
  tools.ozone.moderation.emitEvent.ReportAction['subjectTypes']
>

export const takedown = () =>
  tools.ozone.moderation.defs.modEventTakedown.$build({})

export const label = () =>
  tools.ozone.moderation.defs.modEventLabel.$build({
    createLabelVals: ['spam'],
    negateLabelVals: [],
  })

/** Boot a network for an account/content report linkage suite and expose its shared helpers. */
export function setupAccountActions(dbPostgresSchema: string) {
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
    const name = `accountaction${++fixtureNumber}`
    const { did } = await sc.createAccount(name, {
      handle: `${name}.test`,
      email: `${name}@example.com`,
      password: 'password',
    })
    const records: ReturnType<typeof com.atproto.repo.strongRef.$build>[] = []
    for (let i = 0; i < 2; i++) {
      const post = await sc.post(did, `Example post ${i}`)
      records.push(
        com.atproto.repo.strongRef.$build({
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        }),
      )
    }
    return {
      did,
      account: com.atproto.admin.defs.repoRef.$build({ did }),
      records,
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
  async function reports(
    inputs: (ReportSubject | { subject: ReportSubject; reasonType: string })[],
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
    subject: ReportSubject,
    reasonType: string = com.atproto.moderation.defs.ReasonSpam,
  ) {
    const [row] = await reports([{ subject, reasonType }])
    return row
  }

  async function detail(id: number) {
    const { data } = await mod.agent.tools.ozone.report.getReport(
      { id },
      {
        headers: await network.ozone.modHeaders(ids.ToolsOzoneReportGetReport),
      },
    )
    return {
      status: data.status,
      actionEventIds: data.actionEventIds ?? null,
      updatedAt: data.updatedAt,
      actionNote: data.actionNote,
    }
  }

  async function activities(
    reportId: number,
  ): Promise<ToolsOzoneReportDefs.ReportActivityView[]> {
    const { data } = await mod.agent.tools.ozone.report.listActivities(
      { reportId },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportListActivities,
        ),
      },
    )
    return data.activities
  }

  async function snapshots(reports: { id: number }[]) {
    const result: Awaited<ReturnType<typeof detail>>[] = []
    for (const { id } of reports) result.push(await detail(id))
    return result
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
    detail,
    activities,
    snapshots,
  }
}
