import AtpAgent, { ToolsOzoneReportClaimReport } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import WebSocket from 'ws'
import { AssignmentEvent } from '../src/assignment/assignment-ws'
import { ids } from '../src/lexicon/lexicons'

describe('report-assignment', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const claimReport = async (
    input: ToolsOzoneReportClaimReport.InputSchema,
    callerRole: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) => {
    const { data } = await agent.tools.ozone.report.claimReport(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportClaimReport,
        callerRole,
      ),
    })
    return data
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'report_assignment',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    await network.ozone.ctx.db.db.deleteFrom('moderator_assignment').execute()
  })

  afterAll(async () => {
    await network.close()
  })

  it('moderator can claim', async () => {
    const assignment1 = await claimReport(
      {
        reportId: 1,
        assign: true,
      },
      'moderator',
    )
    expect(assignment1.reportId).toBe(1)
    expect(assignment1.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment1.endAt).getTime()).toBeGreaterThanOrEqual(
      new Date().getTime(),
    )
  })

  it('moderator can refresh claim', async () => {
    const assignment1 = await claimReport(
      {
        reportId: 2,
        assign: true,
      },
      'moderator',
    )
    expect(assignment1.did).toBe(network.ozone.moderatorAccnt.did)

    const assignment2 = await claimReport(
      {
        reportId: 2,
        assign: true,
      },
      'moderator',
    )
    expect(assignment2.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment2.endAt).getTime()).toBeGreaterThan(
      new Date(assignment1.endAt).getTime(),
    )
  })

  it('moderator can claim then un-claim a report', async () => {
    await claimReport(
      {
        reportId: 3,
        assign: true,
      },
      'moderator',
    )
    const assignment = await claimReport(
      {
        reportId: 3,
        assign: false,
      },
      'moderator',
    )
    expect(assignment.reportId).toBe(3)
    expect(assignment.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment.endAt).getTime()).toBeLessThanOrEqual(
      new Date().getTime(),
    )
  })

  it('claim can be exchanged', async () => {
    await claimReport(
      {
        reportId: 4,
        assign: true,
      },
      'moderator',
    )
    await claimReport(
      {
        reportId: 4,
        assign: false,
      },
      'moderator',
    )
    const assignment = await claimReport(
      {
        reportId: 4,
        assign: true,
      },
      'admin',
    )
    expect(assignment.reportId).toBe(4)
    expect(assignment.did).toBe(network.ozone.adminAccnt.did)
    expect(new Date(assignment.endAt).getTime()).toBeGreaterThanOrEqual(new Date().getTime())
  })

  it('cannot double claim', async () => {
    await claimReport(
      {
        reportId: 6,
        assign: true,
      },
      'moderator',
    )
    const p = claimReport(
      {
        reportId: 6,
        assign: true,
      },
      'admin',
    )
    await expect(p).rejects.toThrow('Report already claimed')
  })

  describe('realtime', () => {
    const connectWs = (): Promise<{
      ws: WebSocket
      updates: AssignmentEvent[]
    }> => {
      return new Promise((resolve, reject) => {
        const wsUrl = network.ozone.url.replace('http://', 'ws://')
        const ws = new WebSocket(`${wsUrl}/ws/assignments`)
        const updates: AssignmentEvent[] = []

        ws.on('open', () => resolve({ ws, updates }))
        ws.on('message', (data) => {
          updates.push(JSON.parse(data.toString()))
        })
        ws.on('error', reject)
      })
    }

    it('moderator receives assignment update', async () => {
      const { ws, updates } = await connectWs()

      try {
        await claimReport(
          {
            reportId: 5,
            assign: true,
          },
          'moderator',
        )
        await claimReport(
          {
            reportId: 5,
            assign: false,
          },
          'moderator',
        )
        await claimReport(
          {
            reportId: 5,
            assign: true,
          },
          'admin',
        )

        // Wait for updates to be received
        await new Promise((resolve) => setTimeout(resolve, 100))

        expect(updates.length).toBe(3)
        expect(updates[0].reportId).toBe(5)
        expect(updates[0].did).toBe(network.ozone.moderatorAccnt.did)
        expect(updates[1].reportId).toBe(5)
        expect(updates[1].did).toBe(network.ozone.moderatorAccnt.did)
        expect(updates[2].reportId).toBe(5)
        expect(updates[2].did).toBe(network.ozone.adminAccnt.did)
      } finally {
        ws.close()
      }
    })
  })
})
