import AtpAgent, {
  ToolsOzoneQueueAssignModerator,
  ToolsOzoneQueueGetAssignments,
} from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'

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

  it('lists assignments via getAssignments', async () => {
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
      await expect(p).rejects.toThrow('Cannot assign others')
    })

    it('moderator can unassign from queue', async () => {
      await assign({ queueId: 1, assign: true }, 'moderator')
      const assignment = await assign(
        { queueId: 1, assign: false },
        'moderator',
      )
      expect(assignment.queueId).toBe(1)
      expect(assignment.did).toBe(network.ozone.moderatorAccnt.did)
      expect(new Date(assignment.endAt).getTime()).toBeLessThanOrEqual(
        Date.now() + 1000,
      )
    })

    it('defaults to assign when param is omitted', async () => {
      const assignment = await assign({ queueId: 1 }, 'moderator')
      expect(new Date(assignment.endAt).getTime()).toBeGreaterThan(Date.now())
    })

    it('unassign with no active assignment creates expired record', async () => {
      const assignment = await assign(
        { queueId: 999, assign: false },
        'moderator',
      )
      expect(assignment.queueId).toBe(999)
      expect(new Date(assignment.endAt).getTime()).toBeLessThanOrEqual(
        Date.now() + 1000,
      )
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
})
