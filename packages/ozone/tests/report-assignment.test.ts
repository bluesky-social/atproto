import AtpAgent, { ToolsOzoneReportClaimReport } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import WebSocket from 'ws'
import {
  AssignmentEvent,
  ClientMessage,
  ServerMessage,
} from '../src/assignment/assignment-ws'
import { ids } from '../src/lexicon/lexicons'

describe('report-assignment', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const generateId = () => new Date().getTime() % 10000

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
    await clearAssignments()
  })

  afterAll(async () => {
    await network.close()
  })

  it('moderator can claim', async () => {
    const reportId = generateId()
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
    const reportId = generateId()
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
    const reportId = generateId()
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
    const reportId = generateId()
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
    expect(new Date(assignment.endAt).getTime()).toBeGreaterThanOrEqual(
      new Date().getTime(),
    )
  })

  it('cannot double claim', async () => {
    const reportId = generateId()
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
    const wsConnect = (): Promise<{
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
    const wsSubscribe = (ws: WebSocket, queueId: number) => {
      ws.send(JSON.stringify({ type: 'subscribe', queues: [queueId] }))
    }

    const settle = (ms: number = 100) =>
      new Promise((resolve) => setTimeout(resolve, ms))

    it('subscription receives updates', async () => {
      const queueId = generateId()
      const { ws, updates } = await wsConnect()
      await settle()
      wsSubscribe(ws, queueId)
      await settle()

      try {
        await claimReport(
          {
            reportId: generateId(),
            queueId,
            assign: true,
          },
          'moderator',
        )
        await claimReport(
          {
            reportId: generateId(),
            queueId,
            assign: true,
          },
          'moderator',
        )
        await claimReport(
          {
            reportId: generateId(),
            queueId,
            assign: false,
          },
          'moderator',
        )
        await claimReport(
          {
            reportId: generateId(),
            queueId,
            assign: true,
          },
          'admin',
        )
        await claimReport(
          {
            reportId: generateId(),
            queueId,
            assign: true,
          },
          'moderator',
        )
        await settle()

        expect(updates.length).toBe(6) // intial snapshot + 5 events
      } finally {
        ws.close()
      }
    })

    it('new subscription receives snapshot', async () => {
      const queueId = generateId()
      const reportId = generateId()
      await claimReport(
        {
          reportId,
          queueId,
          assign: true,
        },
        'moderator',
      )

      const { ws, updates } = await wsConnect()
      await settle()
      wsSubscribe(ws, queueId)
      await settle()

      try {
        const snapshot = updates.find(
          (u) => 'type' in u && u.type === 'snapshot',
        ) as (ServerMessage & { type: 'snapshot' }) | undefined
        expect(snapshot).toBeDefined()
        const claimUpdate = snapshot!.events.find(
          (e) => e.reportId === reportId,
        )
        expect(claimUpdate).toBeDefined()
        expect(claimUpdate?.did).toBe(network.ozone.moderatorAccnt.did)
      } finally {
        ws.close()
      }
    })

    it('report can be started', async () => {
      const queueId = generateId()
      const reportId = generateId()

      const { ws, updates } = await wsConnect()
      await settle()
      ws.send(
        JSON.stringify({
          type: 'authenticate',
          did: network.ozone.moderatorAccnt.did,
        } satisfies ClientMessage),
      )
      wsSubscribe(ws, queueId)
      await settle()

      try {
        const message: ClientMessage = {
          type: 'report:review:start',
          reportId,
          queueId,
        }
        ws.send(JSON.stringify(message))
        await settle()

        const claimUpdate = updates.find(
          (u) =>
            'type' in u &&
            u.type === 'report:review:started' &&
            u.reportId === reportId,
        ) as ServerMessage | undefined
        expect(claimUpdate).toBeDefined()
        expect(
          claimUpdate && 'moderator' in claimUpdate
            ? claimUpdate.moderator.did
            : undefined,
        ).toBe(network.ozone.moderatorAccnt.did)
      } finally {
        ws.close()
      }
    })
  })
})
