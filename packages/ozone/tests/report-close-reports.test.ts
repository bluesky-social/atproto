import type AtpAgent from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons.js'
import {
  REASONMISLEADING,
  REASONRUDE,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs.js'

const DEFS = 'tools.ozone.report.defs'

describe('report-close-reports', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const modHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'admin')

  const reportSubject = async (
    subject:
      | { $type: 'com.atproto.admin.defs#repoRef'; did: string }
      | { $type: 'com.atproto.repo.strongRef'; uri: string; cid: string },
    reasonType: string = REASONSPAM,
  ) => {
    await sc.createReport({
      reasonType,
      subject,
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
  }

  const queryReports = async (params: {
    status: string
    subject?: string
    did?: string
  }) => {
    const { data } = await agent.tools.ozone.report.queryReports(params, {
      headers: await modHeaders(ids.ToolsOzoneReportQueryReports),
    })
    return data.reports
  }

  const closeReports = async (input: {
    subject: string
    reportTypes?: string[]
    internalNote?: string
    isAutomated?: boolean
  }) => {
    return agent.tools.ozone.report.closeReports(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportCloseReports,
        'admin',
      ),
    })
  }

  const listActivities = async (reportId: number) => {
    const { data } = await agent.tools.ozone.report.listActivities(
      { reportId },
      { headers: await modHeaders(ids.ToolsOzoneReportListActivities) },
    )
    return data.activities
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_close_reports',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('closes all open reports on an account subject', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      REASONSPAM,
    )
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      REASONRUDE,
    )

    const openBefore = await queryReports({
      status: 'open',
      subject: sc.dids.alice,
    })
    expect(openBefore.length).toBeGreaterThanOrEqual(2)

    const { data } = await closeReports({
      subject: sc.dids.alice,
      internalNote: 'Auto-closed by rules engine.',
      isAutomated: true,
    })

    expect(data.closedCount).toBe(openBefore.length)
    expect(data.reportIds.sort()).toEqual(openBefore.map((r) => r.id).sort())

    const openAfter = await queryReports({
      status: 'open',
      subject: sc.dids.alice,
    })
    expect(openAfter).toHaveLength(0)

    // Each closed report gets a closeActivity with the note + isAutomated
    for (const reportId of data.reportIds) {
      const activities = await listActivities(reportId)
      const close = activities.find(
        (a) => a.activity.$type === `${DEFS}#closeActivity`,
      )
      expect(close).toBeDefined()
      expect(close!.internalNote).toBe('Auto-closed by rules engine.')
      expect(close!.isAutomated).toBe(true)
    }
  })

  it('filters by report types', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      REASONSPAM,
    )
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      REASONMISLEADING,
    )

    const { data } = await closeReports({
      subject: sc.dids.carol,
      reportTypes: [REASONSPAM],
    })
    expect(data.closedCount).toBe(1)

    const stillOpen = await queryReports({
      status: 'open',
      subject: sc.dids.carol,
    })
    expect(stillOpen).toHaveLength(1)
    expect(stillOpen[0].reportType).toBe(REASONMISLEADING)
  })

  it('scopes to record-level reports when subject is an AT-URI', async () => {
    const post = sc.posts[sc.dids.alice][0].ref
    await reportSubject(
      {
        $type: 'com.atproto.repo.strongRef',
        uri: post.uriStr,
        cid: post.cidStr,
      },
      REASONSPAM,
    )
    // account-level report on the same DID should not be touched
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      REASONSPAM,
    )

    const { data } = await closeReports({ subject: post.uriStr })
    expect(data.closedCount).toBe(1)

    const accountReports = await queryReports({
      status: 'open',
      subject: sc.dids.alice,
    })
    expect(accountReports).toHaveLength(1)
  })

  it('scopes message, conversation, and account reports independently', async () => {
    const convoId = 'close-reports-convo'
    const messageId = 'close-reports-message'
    const convoUri = `at://${sc.dids.dan}/chat.bsky.convo/${convoId}`
    const messageUri = `at://${sc.dids.dan}/chat.bsky.convo.message/${messageId}`

    await sc.createReport({
      reasonType: REASONSPAM,
      subject: {
        $type: 'chat.bsky.convo.defs#messageRef',
        did: sc.dids.dan,
        convoId,
        messageId,
      },
      reportedBy: sc.dids.bob,
    })
    await sc.createReport({
      reasonType: REASONSPAM,
      subject: {
        $type: 'chat.bsky.convo.defs#convoRef',
        did: sc.dids.dan,
        convoId,
      },
      reportedBy: sc.dids.bob,
    })
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.dan },
      REASONSPAM,
    )
    await network.processAll()

    const accountResult = await closeReports({ subject: sc.dids.dan })
    expect(accountResult.data.closedCount).toBe(1)

    const messageResult = await closeReports({ subject: messageUri })
    expect(messageResult.data.closedCount).toBe(1)

    const convoResult = await closeReports({ subject: convoUri })
    expect(convoResult.data.closedCount).toBe(1)
  })

  it('returns zero when no reports match', async () => {
    const { data } = await closeReports({
      subject: 'did:plc:doesnotexistanywhere',
    })
    expect(data.closedCount).toBe(0)
    expect(data.reportIds).toEqual([])
  })

  it('rejects a subject that is neither a DID nor an AT-URI', async () => {
    await expect(
      closeReports({ subject: 'https://example.com' }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
  })

  it('closes queued reports too', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.dan },
      REASONSPAM,
    )
    const [report] = await queryReports({
      status: 'open',
      subject: sc.dids.dan,
    })
    await agent.tools.ozone.report.createActivity(
      {
        reportId: report.id,
        activity: { $type: `${DEFS}#queueActivity` },
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportCreateActivity,
          'admin',
        ),
      },
    )

    const { data } = await closeReports({ subject: sc.dids.dan })
    expect(data.closedCount).toBe(1)
    expect(data.reportIds).toEqual([report.id])
  })
})
