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

  let q1: number
  let q2: number
  let q3: number

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

  const createQueue = async (name: string, reportTypes: string[]) => {
    const { data } = await agent.tools.ozone.queue.createQueue(
      {
        name,
        subjectTypes: ['account'],
        reportTypes,
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneQueueCreateQueue,
          'admin',
        ),
      },
    )
    return data
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'queue_assignment',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()

    // Clean up any leftover data from previous runs
    await network.ozone.ctx.db.db.deleteFrom('moderator_assignment').execute()
    await network.ozone.ctx.db.db.deleteFrom('report_queue').execute()

    // Seed queues and capture their actual IDs
    const queue1 = await createQueue('Queue 1', ['com.atproto.moderation.defs#reasonSpam'])
    const queue2 = await createQueue('Queue 2', ['com.atproto.moderation.defs#reasonOther'])
    const queue3 = await createQueue('Queue 3', [
      'com.atproto.moderation.defs#reasonMisleading',
    ])
    q1 = queue1.queue.id
    q2 = queue2.queue.id
    q3 = queue3.queue.id
  })

  afterAll(async () => {
    await network.close()
  })

  it('get active assignments', async () => {
    await assign({ queueId: q1 }, 'admin')
    const result = await getAssignments({ onlyActive: true })

    expect(result.assignments.length).toBeGreaterThanOrEqual(1)
    const queueIds = result.assignments.map((a) => a.queue.id)
    expect(queueIds).toContain(q1)
  })

  it('filters assignments by queueId', async () => {
    await assign({ queueId: q1 }, 'moderator')

    const result = await getAssignments({
      queueIds: [q1],
    })

    expect(result.assignments.length).toBeGreaterThanOrEqual(1)
    expect(result.assignments[0].queue.id).toBe(q1)
  })

  it('filters assignments by dids', async () => {
    await assign({ queueId: q1, did: sc.dids.bob }, 'admin')
    await assign({ queueId: q1, did: sc.dids.carol }, 'admin')

    const result = await getAssignments({
      dids: [sc.dids.bob],
    })

    expect(result.assignments.length).toBeGreaterThanOrEqual(1)
    expect(result.assignments[0].did).toBe(sc.dids.bob)
  })

  it('get assignments for a user', async () => {
    await assign({ queueId: q1, did: sc.dids.bob }, 'admin')

    const result = await getAssignments({
      dids: [sc.dids.bob],
    })

    expect(result.assignments.length).toBeGreaterThanOrEqual(1)
    expect(result.assignments[0].did).toBe(sc.dids.bob)
  })

  it('get active assignments for queue', async () => {
    await clearAssignments()
    await assign({ queueId: q1, did: sc.dids.bob }, 'admin')
    const result = await getAssignments({
      queueIds: [q1],
      onlyActive: true,
    })
    expect(result.assignments.length).toBe(1)
  })

  it('get all assignments for queue', async () => {
    await clearAssignments()
    await assign({ queueId: q1, did: sc.dids.alice }, 'admin')
    const result = await getAssignments({
      queueIds: [q1],
      onlyActive: false,
    })
    expect(result.assignments.length).toBe(1)
  })

  describe('pagination', () => {
    it('paginates assignments with limit', async () => {
      await clearAssignments()
      // Create assignments for multiple queues
      await assign({ queueId: q1, did: sc.dids.alice }, 'admin')
      await assign({ queueId: q2, did: sc.dids.alice }, 'admin')
      await assign({ queueId: q3, did: sc.dids.alice }, 'admin')

      const firstPage = await getAssignments({ limit: 2 })
      expect(firstPage.assignments.length).toBe(2)
      expect(firstPage.cursor).toBeDefined()
    })

    it('returns all results when limit exceeds total', async () => {
      await clearAssignments()
      await assign({ queueId: q1, did: sc.dids.alice }, 'admin')
      await assign({ queueId: q2, did: sc.dids.alice }, 'admin')

      const result = await getAssignments({ limit: 50 })
      expect(result.assignments.length).toBe(2)
      // Cursor always points to the last item returned, even when all results fit in one page
      expect(result.cursor).toBeDefined()
    })

    it('fetches next page using cursor', async () => {
      await clearAssignments()
      await assign({ queueId: q1, did: sc.dids.alice }, 'admin')
      await assign({ queueId: q2, did: sc.dids.bob }, 'admin')
      await assign({ queueId: q3, did: sc.dids.carol }, 'admin')

      const firstPage = await getAssignments({ limit: 2 })
      expect(firstPage.assignments.length).toBe(2)
      expect(firstPage.cursor).toBeDefined()

      const secondPage = await getAssignments({
        limit: 2,
        cursor: firstPage.cursor,
      })
      expect(secondPage.assignments.length).toBe(1)
      // Cursor points to the last item returned; a subsequent fetch with this cursor would return 0 results
      expect(secondPage.cursor).toBeDefined()

      // Ensure no overlap between pages
      const firstPageIds = firstPage.assignments.map((a) => a.id)
      const secondPageIds = secondPage.assignments.map((a) => a.id)
      for (const id of secondPageIds) {
        expect(firstPageIds).not.toContain(id)
      }
    })

    it('returns all assignments across pages', async () => {
      await clearAssignments()
      await assign({ queueId: q1, did: sc.dids.alice }, 'admin')
      await assign({ queueId: q2, did: sc.dids.bob }, 'admin')
      await assign({ queueId: q3, did: sc.dids.carol }, 'admin')

      // Collect all assignments via pagination
      const allAssignments: typeof firstPage.assignments = []
      let cursor: string | undefined
      const firstPage = await getAssignments({ limit: 1 })
      allAssignments.push(...firstPage.assignments)
      cursor = firstPage.cursor

      while (cursor) {
        const page = await getAssignments({ limit: 1, cursor })
        allAssignments.push(...page.assignments)
        cursor = page.cursor
      }

      expect(allAssignments.length).toBe(3)
      // Verify all unique
      const ids = allAssignments.map((a) => a.id)
      expect(new Set(ids).size).toBe(3)
    })

    it('applies filters alongside pagination', async () => {
      await clearAssignments()
      await assign({ queueId: q1, did: sc.dids.alice }, 'admin')
      await assign({ queueId: q1, did: sc.dids.bob }, 'admin')
      await assign({ queueId: q2, did: sc.dids.carol }, 'admin')

      const result = await getAssignments({ queueIds: [q1], limit: 1 })
      expect(result.assignments.length).toBe(1)
      expect(result.assignments[0].queue.id).toBe(q1)
      expect(result.cursor).toBeDefined()

      const nextPage = await getAssignments({
        queueIds: [q1],
        limit: 1,
        cursor: result.cursor,
      })
      expect(nextPage.assignments.length).toBe(1)
      expect(nextPage.assignments[0].queue.id).toBe(q1)
    })
  })

  describe('admin', () => {
    it('should be able to assign self to a queue', async () => {
      const assignment = await assign({ queueId: q1 }, 'admin')

      expect(assignment.queue.id).toBe(q1)
      expect(assignment.did).toBe(network.ozone.adminAccnt.did)

      const assignments = await getAssignments({ onlyActive: true }, 'admin')
      const queueIds = assignments.assignments.map((a) => a.queue.id)
      expect(queueIds).toContain(q1)
    })
    it('should be able to assign a mod to a queue', async () => {
      const assignment = await assign({ queueId: q1, did: sc.dids.bob }, 'admin')

      expect(assignment.queue.id).toBe(q1)
      expect(assignment.did).toBe(sc.dids.bob)

      const assignments = await getAssignments({ onlyActive: true }, 'admin')
      const queueIds = assignments.assignments.map((a) => a.queue.id)
      expect(queueIds).toContain(q1)
    })
    it('should be able to assign multiple mods to a queue', async () => {
      await assign({ queueId: q1, did: sc.dids.bob }, 'admin')
      await assign({ queueId: q1, did: sc.dids.carol }, 'admin')
      const assignments = await getAssignments(
        { onlyActive: true, queueIds: [q1] },
        'admin',
      )
      const dids = assignments.assignments.map((a) => a.did)
      expect(dids).toContain(sc.dids.bob)
      expect(dids).toContain(sc.dids.carol)
    })
  })

  describe('moderator', () => {
    it('should be able to assign self to a queue', async () => {
      const assignment = await assign({ queueId: q1 }, 'moderator')

      expect(assignment.queue.id).toBe(q1)
      expect(assignment.did).toBe(network.ozone.moderatorAccnt.did)

      const assignments = await getAssignments({ onlyActive: true }, 'admin')
      const queueIds = assignments.assignments.map((a) => a.queue.id)
      expect(queueIds).toContain(q1)
    })
    it('should not be able to assign another user to a queue', async () => {
      const p = assign(
        { queueId: q1, did: network.ozone.adminAccnt.did },
        'moderator',
      )
      await expect(p).rejects.toThrow('Unauthorized')
    })

    it('defaults to assign when param is omitted', async () => {
      const assignment = await assign({ queueId: q1 }, 'moderator')
      expect(new Date(assignment.endAt).getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('triage', () => {
    it('should not be able to assign self to a queue', async () => {
      const p = assign({ queueId: q1 }, 'triage')
      await expect(p).rejects.toThrow('Unauthorized')
    })
    it('should not be able to assign another user to a queue', async () => {
      const p = assign(
        { queueId: q1, did: network.ozone.adminAccnt.did },
        'triage',
      )
      await expect(p).rejects.toThrow('Unauthorized')
    })
  })
})
