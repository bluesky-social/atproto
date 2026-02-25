import AtpAgent, {
  ToolsOzoneQueueAssignModerator,
  ToolsOzoneQueueGetAssignments,
} from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { ServerMessage } from '../src/assignment/assignment-ws'
import WebSocket from 'ws'
import { wait } from '@atproto/common'
import { generateId } from './_util'

describe('queue', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const assign = async (
    input: ToolsOzoneQueueAssignModerator.InputSchema,
    callerRole: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) => {
    const { data } = await agent.tools.ozone.queue.assignModerator(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneQueueAssignModerator,
        callerRole,
      ),
    })
    return data
  }

  const getAssignments = async (
    input: ToolsOzoneQueueGetAssignments.QueryParams,
    callerRole: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) => {
    const { data } = await agent.tools.ozone.queue.getAssignments(input, {
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneQueueGetAssignments,
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
      dbPostgresSchema: 'queue',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('get active assignments', async () => {
    await assign({ queueId: 1 }, 'admin')
    const result = await getAssignments({ onlyActiveAssignments: true })

    expect(result.assignments.length).toBeGreaterThanOrEqual(1)
    const queueIds = result.assignments.map((a) => a.queueId)
    expect(queueIds).toContain(1)
  })

  it('filters assignments by queueId', async () => {
    await assign({ queueId: 1 }, 'moderator')

    const result = await getAssignments({
      queueIds: [1],
    })

    expect(result.assignments.length).toBeGreaterThanOrEqual(1)
    expect(result.assignments[0].queueId).toBe(1)
  })

  it('filters assignments by dids', async () => {
    await assign({ queueId: 1, did: sc.dids.bob }, 'admin')
    await assign({ queueId: 1, did: sc.dids.carol }, 'admin')

    const result = await getAssignments({
      dids: [sc.dids.bob],
    })

    expect(result.assignments.length).toBeGreaterThanOrEqual(1)
    expect(result.assignments[0].did).toBe(sc.dids.bob)
  })

  it('get assignments for a user', async () => {
    await assign({ queueId: 1, did: sc.dids.bob }, 'admin')

    const result = await getAssignments({
      dids: [sc.dids.bob],
    })

    expect(result.assignments.length).toBeGreaterThanOrEqual(1)
    expect(result.assignments[0].did).toBe(sc.dids.bob)
  })

  it('get active assignments for queue', async () => {
    await clearAssignments()
    await assign({ queueId: 1, did: sc.dids.bob }, 'admin')
    const result = await getAssignments({
      queueIds: [1],
      onlyActiveAssignments: true,
    })
    expect(result.assignments.length).toBe(1)
  })

  it('get all assignments for queue', async () => {
    await clearAssignments()
    await assign({ queueId: 1, did: sc.dids.alice }, 'admin')
    const result = await getAssignments({
      queueIds: [1],
      onlyActiveAssignments: false,
    })
    expect(result.assignments.length).toBe(1)
  })

  describe('admin', () => {
    it('should be able to assign self to a queue', async () => {
      const assignment = await assign({ queueId: 1 }, 'admin')

      expect(assignment.queueId).toBe(1)
      expect(assignment.did).toBe(network.ozone.adminAccnt.did)

      const assignments = await getAssignments(
        { onlyActiveAssignments: true },
        'admin',
      )
      const queueIds = assignments.assignments.map((a) => a.queueId)
      expect(queueIds).toContain(1)
    })
    it('should be able to assign a mod to a queue', async () => {
      const assignment = await assign({ queueId: 1, did: sc.dids.bob }, 'admin')

      expect(assignment.queueId).toBe(1)
      expect(assignment.did).toBe(sc.dids.bob)

      const assignments = await getAssignments(
        { onlyActiveAssignments: true },
        'admin',
      )
      const queueIds = assignments.assignments.map((a) => a.queueId)
      expect(queueIds).toContain(1)
    })
    it('should be able to assign multiple mods to a queue', async () => {
      await assign({ queueId: 1, did: sc.dids.bob }, 'admin')
      await assign({ queueId: 1, did: sc.dids.carol }, 'admin')
      const assignments = await getAssignments(
        { onlyActiveAssignments: true, queueIds: [1] },
        'admin',
      )
      const dids = assignments.assignments.map((a) => a.did)
      expect(dids).toContain(sc.dids.bob)
      expect(dids).toContain(sc.dids.carol)
    })
  })

  describe('moderator', () => {
    it('should be able to assign self to a queue', async () => {
      const assignment = await assign({ queueId: 1 }, 'moderator')

      expect(assignment.queueId).toBe(1)
      expect(assignment.did).toBe(network.ozone.moderatorAccnt.did)

      const assignments = await getAssignments(
        { onlyActiveAssignments: true },
        'admin',
      )
      const queueIds = assignments.assignments.map((a) => a.queueId)
      expect(queueIds).toContain(1)
    })
    it('should not be able to assign another user to a queue', async () => {
      const p = assign(
        { queueId: 1, did: network.ozone.adminAccnt.did },
        'moderator',
      )
      await expect(p).rejects.toThrow('Unauthorized')
    })

    it('defaults to assign when param is omitted', async () => {
      const assignment = await assign({ queueId: 1 }, 'moderator')
      expect(new Date(assignment.endAt).getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('triage', () => {
    it('should not be able to assign self to a queue', async () => {
      const p = assign({ queueId: 1 }, 'triage')
      await expect(p).rejects.toThrow('Unauthorized')
    })
    it('should not be able to assign another user to a queue', async () => {
      const p = assign(
        { queueId: 1, did: network.ozone.adminAccnt.did },
        'triage',
      )
      await expect(p).rejects.toThrow('Unauthorized')
    })
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
    const wsAssign = async (ws: WebSocket, queueId: number, did: string) => {
      ws.send(JSON.stringify({ type: 'queue:assign', queueId, did }))
    }

    it('assign to queue', async () => {
      const queueId = generateId()
      const { ws, updates } = await wsConnect('moderator')
      wsSubscribe(ws, queueId)

      await wsAssign(ws, queueId, network.ozone.moderatorAccnt.did)
      await wait(100)

      expect(updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'queue:assigned', queueId }),
        ]),
      )
    })
  })
})
