import AtpAgent, { ToolsOzoneReportClaimReport } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import WebSocket from 'ws'
import { AssignmentEvent } from '../src/assignment/assignment-ws'
import { ids } from '../src/lexicon/lexicons'

describe('report-assignment', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const generateReportId = () => new Date().getTime() % 1000

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

  const clearAssignments = async () => {
    await network.ozone.ctx.db.db.deleteFrom('moderator_assignment').execute()
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'report_assignment',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  beforeEach(async () => {
    await clearAssignments()
  })

  afterAll(async () => {
    await network.close()
  })

  it('moderator can claim', async () => {
    const reportId = generateReportId()
    const assignment1 = await claimReport(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    expect(assignment1.reportId).toBe(reportId)
    expect(assignment1.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment1.endAt).getTime()).toBeGreaterThanOrEqual(
      new Date().getTime(),
    )
  })

  it('moderator can refresh claim', async () => {
    const reportId = generateReportId()
    const assignment1 = await claimReport(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    const assignment2 = await claimReport(
      {
        reportId,
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
    const reportId = generateReportId()
    await claimReport(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    const assignment = await claimReport(
      {
        reportId,
        assign: false,
      },
      'moderator',
    )
    expect(new Date(assignment.endAt).getTime()).toBeLessThanOrEqual(
      new Date().getTime(),
    )
  })

  it('claim can be exchanged', async () => {
    const reportId = generateReportId()
    await claimReport(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    await claimReport(
      {
        reportId,
        assign: false,
      },
      'moderator',
    )
    const assignment = await claimReport(
      {
        reportId,
        assign: true,
      },
      'admin',
    )
    expect(assignment.reportId).toBe(reportId)
    expect(assignment.did).toBe(network.ozone.adminAccnt.did)
    expect(new Date(assignment.endAt).getTime()).toBeGreaterThanOrEqual(new Date().getTime())
  })

  it('cannot double claim', async () => {
    const reportId = generateReportId()
    await claimReport(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    await expect(
      claimReport(
        {
          reportId,
          assign: true,
        },
        'admin',
      ),
    ).rejects.toThrow('Report already claimed')
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

    const settle = (ms: number = 100) =>
      new Promise((resolve) => setTimeout(resolve, ms))

    it('moderator receives assignment updates', async () => {
      const reportId = generateReportId()
      const { ws, updates } = await connectWs()
      await settle()
      const initialCount = updates.length

      try {
        await claimReport(
          {
            reportId,
            assign: true,
          },
          'moderator',
        )
        await claimReport(
          {
            reportId,
            assign: false,
          },
          'moderator',
        )
        await claimReport(
          {
            reportId,
            assign: true,
          },
          'admin',
        )
        await settle()

        const newUpdates = updates.slice(initialCount)
        expect(newUpdates.length).toBe(3)
        expect(newUpdates[0].reportId).toBe(reportId)
        expect(newUpdates[0].did).toBe(network.ozone.moderatorAccnt.did)
        expect(newUpdates[1].reportId).toBe(reportId)
        expect(newUpdates[1].did).toBe(network.ozone.moderatorAccnt.did)
        expect(newUpdates[2].reportId).toBe(reportId)
        expect(newUpdates[2].did).toBe(network.ozone.adminAccnt.did)
      } finally {
        ws.close()
      }
    })

    it('new subscription receives latest assignment state', async () => {
      const reportId = generateReportId()
      await claimReport(
        {
          reportId,
          assign: true,
        },
        'moderator',
      )

      const { ws, updates } = await connectWs()
      await settle()

      ws.send(JSON.stringify({ type: 'subscribe', queues: [] }))
      await settle()

      try {
        const claimUpdate = updates.find((u) => u.reportId === reportId)
        expect(claimUpdate).toBeDefined()
        expect(claimUpdate?.did).toBe(network.ozone.moderatorAccnt.did)
      } finally {
        ws.close()
      }
    })

    it('ping refreshes assignment', async () => {
      const reportId = generateReportId()

      const { ws, updates } = await connectWs()
      await settle()
      const initialCount = updates.length

      try {

        await claimReport(
          {
            reportId,
            assign: true,
          },
          'moderator',
        )

        // Wait for update to be received
        await settle()
        const claimUpdate = updates[initialCount]
        const originalEndAt = new Date(claimUpdate.endAt).getTime()

        // Send ping
        ws.send(JSON.stringify({ type: 'ping' }))
        await settle()

        const newUpdates = updates.slice(initialCount)
        expect(newUpdates.length).toBe(2)
        expect(newUpdates[1].reportId).toBe(reportId)
        expect(newUpdates[1].did).toBe(network.ozone.moderatorAccnt.did)
        const refreshedEndAt = new Date(newUpdates[1].endAt).getTime()
        expect(refreshedEndAt).toBeGreaterThan(originalEndAt)
      } finally {
        ws.close()
      }
    })
  })
})
