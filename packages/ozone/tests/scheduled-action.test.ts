import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { forSnapshot } from './_util'

const allStatuses = ['pending', 'executed', 'cancelled', 'failed']

describe('scheduled action management', () => {
  let network: TestNetwork
  let adminAgent: AtpAgent
  let modAgent: AtpAgent
  let triageAgent: AtpAgent
  let sc: SeedClient

  const getAdminHeaders = async (route: string) => {
    return {
      headers: await network.ozone.modHeaders(route, 'admin'),
    }
  }

  const getModHeaders = async (route: string) => {
    return {
      headers: await network.ozone.modHeaders(route, 'moderator'),
    }
  }

  const getModEvent = async (params: {
    subject: string
    cancellation?: boolean
  }) => {
    const {
      data: { events },
    } = await adminAgent.tools.ozone.moderation.queryEvents(
      {
        subject: params.subject,
        types: [
          params.cancellation
            ? 'tools.ozone.moderation.defs#cancelScheduledTakedownEvent'
            : 'tools.ozone.moderation.defs#scheduleTakedownEvent',
        ],
      },
      await getAdminHeaders(ids.ToolsOzoneModerationQueryEvents),
    )
    return events
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_scheduled_action_test',
    })
    adminAgent = network.ozone.getClient()
    modAgent = network.ozone.getClient()
    triageAgent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('scheduleAction', () => {
    const getTestAction = () => ({
      action: {
        $type: 'tools.ozone.moderation.scheduleAction#takedown',
        comment: 'test',
        policies: ['spam'],
      },
      subjects: [sc.dids.carol, sc.dids.bob],
      createdBy: 'did:plc:moderator',
      scheduling: {
        executeAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      },
    })

    it('allows admins to schedule actions', async () => {
      const { data: result } =
        await adminAgent.tools.ozone.moderation.scheduleAction(
          getTestAction(),
          await getAdminHeaders(ids.ToolsOzoneModerationScheduleAction),
        )
      const bobsModEvents = await getModEvent({ subject: sc.dids.bob })

      expect(result.succeeded.length).toBe(2)
      expect(result.failed.length).toBe(0)
      expect(result.succeeded).toContain(sc.dids.carol)
      expect(result.succeeded).toContain(sc.dids.bob)
      expect(bobsModEvents.length).toBe(1)
    })

    it('rejects triage role from scheduling actions', async () => {
      await expect(
        triageAgent.tools.ozone.moderation.scheduleAction(getTestAction(), {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneModerationScheduleAction,
            'triage',
          ),
        }),
      ).rejects.toThrow('Must be a moderator to schedule actions')
    })

    it('supports scheduling with time range (executeAfter/executeUntil)', async () => {
      const rangeAction = {
        ...getTestAction(),
        subjects: [sc.dids.alice],
        scheduling: {
          executeAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min from now
          executeUntil: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // 90 min from now
        },
      }

      const { data: result } =
        await adminAgent.tools.ozone.moderation.scheduleAction(
          rangeAction,
          await getAdminHeaders(ids.ToolsOzoneModerationScheduleAction),
        )
      expect(result.succeeded.length).toBe(1)
      expect(result.succeeded).toContain(sc.dids.alice)
    })

    it('prevents scheduling multiple actions for same subject', async () => {
      const duplicateAction = {
        ...getTestAction(),
        subjects: [sc.dids.carol],
        scheduling: {
          executeAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        },
      }

      const { data: result } =
        await adminAgent.tools.ozone.moderation.scheduleAction(
          duplicateAction,
          await getAdminHeaders(ids.ToolsOzoneModerationScheduleAction),
        )
      expect(result.succeeded.length).toBe(0)
      expect(result.failed.length).toBe(1)
      expect(result.failed[0].subject).toBe(sc.dids.carol)
      expect(result.failed[0].error).toContain(
        'A pending scheduled action already exists',
      )
    })

    it('validates scheduling parameters', async () => {
      const invalidAction = {
        ...getTestAction(),
        subjects: ['did:plc:test_invalid'],
        scheduling: {
          executeAfter: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
          executeUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // executeUntil before executeAfter
        },
      }

      const { data } = await adminAgent.tools.ozone.moderation.scheduleAction(
        invalidAction,
        await getAdminHeaders(ids.ToolsOzoneModerationScheduleAction),
      )

      expect(data.failed.length).toBe(1)
      expect(data.failed[0].subject).toBe('did:plc:test_invalid')
      expect(data.failed[0].error).toContain(
        'executeAfter must be before executeUntil',
      )
    })
  })

  describe('listScheduledActions', () => {
    it('allows moderators to list all scheduled actions', async () => {
      const { data: result } =
        await modAgent.tools.ozone.moderation.listScheduledActions(
          { statuses: allStatuses },
          await getModHeaders(ids.ToolsOzoneModerationListScheduledActions),
        )

      expect(result.actions.length).toBeGreaterThan(0)
      expect(forSnapshot(result.actions)).toMatchSnapshot()
    })

    it('allows filtering by subjects', async () => {
      const { data: result } =
        await adminAgent.tools.ozone.moderation.listScheduledActions(
          {
            subjects: [sc.dids.carol],
            statuses: allStatuses,
          },
          await getAdminHeaders(ids.ToolsOzoneModerationListScheduledActions),
        )

      expect(result.actions.length).toBeGreaterThan(0)
      result.actions.forEach((action) => {
        expect(action.did).toBe(sc.dids.carol)
      })
    })

    it('allows filtering by status', async () => {
      const { data: result } =
        await adminAgent.tools.ozone.moderation.listScheduledActions(
          {
            statuses: ['pending'],
          },
          await getAdminHeaders(ids.ToolsOzoneModerationListScheduledActions),
        )

      expect(result.actions.length).toBeGreaterThan(0)
      result.actions.forEach((action) => {
        expect(action.status).toBe('pending')
      })
    })

    it('supports time range filtering', async () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)

      const { data: result } =
        await adminAgent.tools.ozone.moderation.listScheduledActions(
          {
            startsAfter: oneHourAgo.toISOString(),
            endsBefore: twoHoursFromNow.toISOString(),
            statuses: allStatuses,
          },
          await getAdminHeaders(ids.ToolsOzoneModerationListScheduledActions),
        )

      expect(result.actions.length).toBeGreaterThan(0)
    })

    it('supports pagination', async () => {
      const headers = await getAdminHeaders(
        ids.ToolsOzoneModerationListScheduledActions,
      )
      const { data: page1 } =
        await adminAgent.tools.ozone.moderation.listScheduledActions(
          { limit: 2, statuses: allStatuses },
          headers,
        )

      expect(page1.actions.length).toBe(2)
      expect(page1.cursor).toBeDefined()

      const { data: page2 } =
        await adminAgent.tools.ozone.moderation.listScheduledActions(
          {
            limit: 2,
            statuses: allStatuses,
            cursor: page1.cursor,
          },
          headers,
        )

      expect(page2.actions.length).toBeGreaterThan(0)
      expect(page1.actions.map((a) => a.did)).not.toContain(
        page2.actions[0].did,
      )
    })
  })

  describe('cancelScheduledActions', () => {
    it('allows moderators to cancel scheduled actions', async () => {
      const { data: result } =
        await modAgent.tools.ozone.moderation.cancelScheduledActions(
          {
            subjects: [sc.dids.bob],
          },
          await getModHeaders(ids.ToolsOzoneModerationCancelScheduledActions),
        )
      const bobsModEvents = await getModEvent({
        subject: sc.dids.bob,
        cancellation: true,
      })
      expect(result.succeeded.length).toBe(1)
      expect(result.failed.length).toBe(0)
      expect(result.succeeded).toContain(sc.dids.bob)
      expect(bobsModEvents.length).toBe(1)
    })

    it('allows admins to cancel scheduled actions', async () => {
      const { data: result } =
        await adminAgent.tools.ozone.moderation.cancelScheduledActions(
          {
            subjects: [sc.dids.carol],
          },
          await getAdminHeaders(ids.ToolsOzoneModerationCancelScheduledActions),
        )

      expect(result.succeeded.length).toBe(1)
      expect(result.failed.length).toBe(0)
      expect(result.succeeded).toContain(sc.dids.carol)

      const {
        data: { actions },
      } = await adminAgent.tools.ozone.moderation.listScheduledActions(
        {
          statuses: allStatuses,
          subjects: [sc.dids.carol],
        },
        await getAdminHeaders(ids.ToolsOzoneModerationListScheduledActions),
      )

      expect(actions[0].status).toBe('cancelled')
    })

    it('handles cancellation of non-existent actions', async () => {
      const { data: result } =
        await adminAgent.tools.ozone.moderation.cancelScheduledActions(
          {
            subjects: ['did:plc:nonexistent'],
          },
          await getAdminHeaders(ids.ToolsOzoneModerationCancelScheduledActions),
        )

      expect(result.succeeded.length).toBe(0)
      expect(result.failed.length).toBe(1)
      expect(result.failed[0].did).toBe('did:plc:nonexistent')
      expect(result.failed[0].error).toContain(
        'No pending scheduled actions found',
      )
    })

    it('rejects triage moderators from cancelling actions', async () => {
      await expect(
        triageAgent.tools.ozone.moderation.cancelScheduledActions(
          { subjects: [sc.dids.carol] },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneModerationCancelScheduledActions,
              'triage',
            ),
          },
        ),
      ).rejects.toThrow('Must be a moderator to cancel scheduled actions')
    })
  })
})
