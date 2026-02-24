import AtpAgent, {
  ToolsOzoneReportAssignModerator,
  ToolsOzoneReportGetAssignments,
} from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import WebSocket from 'ws'
import { ClientMessage, ServerMessage } from '../src/assignment/assignment-ws'
import { ids } from '../src/lexicon/lexicons'
import { wait } from './_util'

describe('report-assignment', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let lastId = 0
  const generateId = () => ++lastId

  const assignModerator = async (
    input: ToolsOzoneReportAssignModerator.InputSchema,
    callerRole: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) => {
    const { data } = await agent.tools.ozone.report.assignModerator(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportAssignModerator,
        callerRole,
      ),
    })
    return data
  }

  const getAssignments = async (
    input: ToolsOzoneReportGetAssignments.QueryParams,
    callerRole: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) => {
    const { data } = await agent.tools.ozone.report.getAssignments(input, {
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportGetAssignments,
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

  it('can get assignment history', async () => {
    const reportId = generateId()
    await assignModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    const result = await getAssignments({ reportIds: [reportId] })
    expect(result.assignments.length).toBe(1)
  })

  it('moderator can assigned', async () => {
    const reportId = generateId()
    const assignment1 = await assignModerator(
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

  it('moderator can refresh assignment', async () => {
    const reportId = generateId()
    const assignment1 = await assignModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    const assignment2 = await assignModerator(
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

  it('moderator can assign then un-assign a report', async () => {
    const reportId = generateId()
    await assignModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    const assignment = await assignModerator(
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

  it('assignment can be exchanged', async () => {
    const reportId = generateId()
    await assignModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    await assignModerator(
      {
        reportId,
        assign: false,
      },
      'moderator',
    )
    const assignment = await assignModerator(
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

  it('cannot double assign', async () => {
    const reportId = generateId()
    await assignModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    await expect(
      assignModerator(
        {
          reportId,
          assign: true,
        },
        'admin',
      ),
    ).rejects.toThrow('Report already assigned')
  })

  describe('realtime', () => {
    const wsConnect = async (
      role: 'admin' | 'moderator' | 'triage' = 'moderator',
    ): Promise<{
      ws: WebSocket
      updates: ServerMessage[]
    }> => {
      const headers = await network.ozone.modHeaders(
        'com.atproto.server.createSession',
        role,
      )
      return new Promise((resolve, reject) => {
        const wsUrl = network.ozone.url.replace('http://', 'ws://')
        const ws = new WebSocket(`${wsUrl}/ws/assignments`, { headers })
        const updates: ServerMessage[] = []

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

    it('subscription receives updates', async () => {
      const queueId = generateId()
      const { ws, updates } = await wsConnect()
      await wait()
      wsSubscribe(ws, queueId)
      await wait()

      try {
        await assignModerator(
          {
            reportId: generateId(),
            queueId,
            assign: true,
          },
          'moderator',
        )
        await assignModerator(
          {
            reportId: generateId(),
            queueId,
            assign: true,
          },
          'moderator',
        )
        await assignModerator(
          {
            reportId: generateId(),
            queueId,
            assign: false,
          },
          'moderator',
        )
        await assignModerator(
          {
            reportId: generateId(),
            queueId,
            assign: true,
          },
          'admin',
        )
        await assignModerator(
          {
            reportId: generateId(),
            queueId,
            assign: true,
          },
          'moderator',
        )
        await wait()

        expect(updates.length).toBe(6) // intial snapshot + 5 events
      } finally {
        ws.close()
      }
    })

    it('new subscription receives snapshot', async () => {
      const queueId = generateId()
      const reportId = generateId()
      await assignModerator(
        {
          reportId,
          queueId,
          assign: true,
        },
        'moderator',
      )

      const { ws, updates } = await wsConnect()
      await wait()
      wsSubscribe(ws, queueId)
      await wait()

      try {
        const snapshot = updates.find(
          (u) => 'type' in u && u.type === 'snapshot',
        ) as (ServerMessage & { type: 'snapshot' }) | undefined
        expect(snapshot).toBeDefined()
        const update = snapshot!.events.find((e) => e.reportId === reportId)
        expect(update).toBeDefined()
        expect(update?.did).toBe(network.ozone.moderatorAccnt.did)
      } finally {
        ws.close()
      }
    })

    it('report can be started', async () => {
      const queueId = generateId()
      const reportId = generateId()

      const { ws, updates } = await wsConnect('moderator')
      await wait()
      wsSubscribe(ws, queueId)
      await wait()

      try {
        const message: ClientMessage = {
          type: 'report:review:start',
          reportId,
          queueId,
        }
        ws.send(JSON.stringify(message))
        await wait()

        const update = updates.find(
          (u) =>
            'type' in u &&
            u.type === 'report:review:started' &&
            u.reportId === reportId,
        ) as ServerMessage | undefined
        expect(update).toBeDefined()
        expect(
          update && 'moderator' in update ? update.moderator.did : undefined,
        ).toBe(network.ozone.moderatorAccnt.did)
      } finally {
        ws.close()
      }
    })

    it('report can be ended', async () => {
      const queueId = generateId()
      const reportId = generateId()

      const { ws, updates } = await wsConnect('moderator')
      await wait()
      wsSubscribe(ws, queueId)
      await wait()

      try {
        let message: ClientMessage = {
          type: 'report:review:start',
          reportId,
          queueId,
        }
        ws.send(JSON.stringify(message))
        await wait()

        message = {
          type: 'report:review:end',
          reportId,
          queueId,
        }
        ws.send(JSON.stringify(message))
        await wait()

        const update = updates.find(
          (u) =>
            'type' in u &&
            u.type === 'report:review:ended' &&
            u.reportId === reportId,
        ) as ServerMessage | undefined
        expect(update).toBeDefined()
        expect(
          update && 'moderator' in update ? update.moderator.did : undefined,
        ).toBe(network.ozone.moderatorAccnt.did)
      } finally {
        ws.close()
      }
    })
  })
})
