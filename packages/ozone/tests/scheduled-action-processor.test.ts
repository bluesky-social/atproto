import { AtpAgent } from '@atproto/api'
import { HOUR, MINUTE } from '@atproto/common'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ModEventTakedown } from '../dist/lexicon/types/tools/ozone/moderation/defs'
import { ids } from '../src/lexicon/lexicons'

describe('scheduled action processor', () => {
  let network: TestNetwork
  let adminAgent: AtpAgent
  let sc: SeedClient

  const getAdminHeaders = async (route: string) => {
    return {
      headers: await network.ozone.modHeaders(route, 'admin'),
    }
  }

  const scheduleTestAction = async (subject: string, scheduling: any) => {
    return await adminAgent.tools.ozone.moderation.scheduleAction(
      {
        action: {
          $type: 'tools.ozone.moderation.scheduleAction#takedown',
          comment: 'Test scheduled takedown',
          policies: ['spam'],
        },
        subjects: [subject],
        createdBy: 'did:plc:moderator',
        scheduling,
      },
      await getAdminHeaders(ids.ToolsOzoneModerationScheduleAction),
    )
  }

  const getScheduledActions = async (
    subjects?: string[],
    statuses?: string[],
  ) => {
    const { data } =
      await adminAgent.tools.ozone.moderation.listScheduledActions(
        { subjects, statuses },
        await getAdminHeaders(ids.ToolsOzoneModerationListScheduledActions),
      )
    return data.actions
  }

  const getModerationEvents = async (subject: string, types?: string[]) => {
    const { data } = await adminAgent.tools.ozone.moderation.queryEvents(
      { subject, types },
      await getAdminHeaders(ids.ToolsOzoneModerationQueryEvents),
    )
    return data.events
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_scheduled_action_processor_test',
    })
    adminAgent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('findAndExecuteScheduledActions', () => {
    it('processes actions scheduled for immediate execution', async () => {
      const testSubject = sc.dids.alice

      const pastTime = new Date(Date.now() - 1000).toISOString()
      await scheduleTestAction(testSubject, { executeAt: pastTime })

      const pendingActions = await getScheduledActions(
        [testSubject],
        ['pending'],
      )
      expect(pendingActions.length).toBe(1)

      await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()

      const executedActions = await getScheduledActions(
        [testSubject],
        ['executed'],
      )
      expect(executedActions.length).toBe(1)
      expect(executedActions[0].status).toBe('executed')
      expect(executedActions[0].executionEventId).toBeDefined()

      const modEvents = await getModerationEvents(testSubject, [
        'tools.ozone.moderation.defs#modEventTakedown',
      ])
      expect(modEvents.length).toBe(1)

      expect(modEvents[0].event['comment']).toContain(
        '[SCHEDULED_ACTION] Test scheduled takedown',
      )
    })

    it('skips actions scheduled for future execution', async () => {
      const testSubject = sc.dids.bob

      // Schedule an action for future execution (1 hour from now)
      const futureTime = new Date(Date.now() + HOUR).toISOString()
      await scheduleTestAction(testSubject, { executeAt: futureTime })

      // Process scheduled actions
      await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()

      // Verify action is still pending
      const pendingActions = await getScheduledActions(
        [testSubject],
        ['pending'],
      )
      expect(pendingActions.length).toBe(1)

      const executedActions = await getScheduledActions(
        [testSubject],
        ['executed'],
      )
      expect(executedActions.length).toBe(0)
    })

    it('processes randomized scheduling actions within time window', async () => {
      const testSubject = sc.dids.carol

      // Schedule an action with time range (past executeAfter, future executeUntil)
      const pastTime = new Date(Date.now() - 30 * MINUTE).toISOString()
      const futureTime = new Date(Date.now() + 30 * MINUTE).toISOString()
      await scheduleTestAction(testSubject, {
        executeAfter: pastTime,
        executeUntil: futureTime,
      })

      // Process multiple times to account for randomization
      let executed = false
      for (let i = 0; i < 20 && !executed; i++) {
        await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()
        const executedActions = await getScheduledActions(
          [testSubject],
          ['executed'],
        )
        if (executedActions.length > 0) {
          executed = true
          expect(executedActions[0].status).toBe('executed')
        }
      }

      // At least verify the action is eligible for processing
      const actions = await getScheduledActions([testSubject])
      expect(actions.length).toBe(1)
      expect(actions[0].randomizeExecution).toBe(true)
    })

    it('skips randomized actions before executeAfter time', async () => {
      const testSubject = 'did:plc:future_randomized'

      // Schedule an action with future executeAfter
      const futureAfter = new Date(Date.now() + 30 * MINUTE).toISOString()
      const futureUntil = new Date(Date.now() + HOUR).toISOString()
      await scheduleTestAction(testSubject, {
        executeAfter: futureAfter,
        executeUntil: futureUntil,
      })

      // Process scheduled actions
      await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()

      // Verify action is still pending
      const pendingActions = await getScheduledActions(
        [testSubject],
        ['pending'],
      )
      expect(pendingActions.length).toBe(1)
    })

    it('always executes randomized actions past executeUntil deadline', async () => {
      const testSubject = 'did:plc:overdue_randomized'

      // Schedule an action that's past its deadline
      const pastAfter = new Date(Date.now() - HOUR).toISOString()
      const pastUntil = new Date(Date.now() - 30 * MINUTE).toISOString()
      await scheduleTestAction(testSubject, {
        executeAfter: pastAfter,
        executeUntil: pastUntil,
      })

      // Process scheduled actions
      await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()

      // Verify action is executed (should always execute past deadline)
      const executedActions = await getScheduledActions(
        [testSubject],
        ['executed'],
      )
      expect(executedActions.length).toBe(1)
      expect(executedActions[0].status).toBe('executed')
    })
  })

  describe('executeScheduledAction', () => {
    it('handles takedown actions with all properties', async () => {
      const testSubject = 'did:plc:detailed_takedown'

      // Schedule a detailed takedown action
      await adminAgent.tools.ozone.moderation.scheduleAction(
        {
          action: {
            $type: 'tools.ozone.moderation.scheduleAction#takedown',
            comment: 'Detailed takedown test',
            durationInHours: 24,
            acknowledgeAccountSubjects: true,
            policies: ['spam', 'harassment'],
          },
          subjects: [testSubject],
          createdBy: 'did:plc:moderator',
          scheduling: {
            executeAt: new Date(Date.now() - 1000).toISOString(),
          },
          modTool: { name: 'test-tool' },
        },
        await getAdminHeaders(ids.ToolsOzoneModerationScheduleAction),
      )

      // Process the action
      await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()

      // Verify the moderation event has all properties
      const modEvents = await getModerationEvents(testSubject, [
        'tools.ozone.moderation.defs#modEventTakedown',
      ])
      expect(modEvents.length).toBe(1)

      const takedownEvent = modEvents[0].event as ModEventTakedown
      expect(takedownEvent.comment).toContain('[SCHEDULED_ACTION]')
      expect(takedownEvent.comment).toContain('Detailed takedown test')
      expect(takedownEvent.durationInHours).toBe(24)
      expect(takedownEvent.acknowledgeAccountSubjects).toBe(true)
      expect(takedownEvent.policies).toEqual(['spam', 'harassment'])
    })

    it('marks action as failed when moderation event creation fails', async () => {
      const testSubject = 'did:plc:invalid_subject'

      await scheduleTestAction(testSubject, {
        executeAt: new Date(Date.now() - 1000).toISOString(),
      })

      const pendingActions = await getScheduledActions(
        [testSubject],
        ['pending'],
      )
      expect(pendingActions.length).toBe(1)
      const actionId = pendingActions[0].id

      // Manually update the action type to trigger error in processing
      await network.ozone.ctx.db.db
        .updateTable('scheduled_action')
        .set({ action: 'unknown' })
        .where('id', '=', actionId)
        .execute()

      await network.ozone.daemon.ctx.scheduledActionProcessor.executeScheduledAction(
        actionId,
      )

      const failedActions = await getScheduledActions([testSubject], ['failed'])
      expect(failedActions.length).toBe(1)
      expect(failedActions[0].status).toBe('failed')
      expect(failedActions[0].lastFailureReason).toBeDefined()
    })

    it('skips actions that are no longer pending', async () => {
      const testSubject = 'did:plc:already_processed'

      // Schedule and then cancel an action
      await scheduleTestAction(testSubject, {
        executeAt: new Date(Date.now() - 1000).toISOString(),
      })

      await adminAgent.tools.ozone.moderation.cancelScheduledActions(
        { subjects: [testSubject] },
        await getAdminHeaders(ids.ToolsOzoneModerationCancelScheduledActions),
      )

      const cancelledActions = await getScheduledActions(
        [testSubject],
        ['cancelled'],
      )
      expect(cancelledActions.length).toBe(1)
      const actionId = cancelledActions[0].id

      await network.ozone.daemon.ctx.scheduledActionProcessor.executeScheduledAction(
        actionId,
      )

      const modEvents = await getModerationEvents(testSubject)
      const takedownEvents = modEvents.filter(
        (e) => e.event.$type === 'tools.ozone.moderation.defs#modEventTakedown',
      )
      expect(takedownEvents.length).toBe(0)
    })

    it('processes multiple actions in batch', async () => {
      const subjects = ['did:plc:batch1', 'did:plc:batch2', 'did:plc:batch3']
      const pastTime = new Date(Date.now() - 1000).toISOString()

      for (const subject of subjects) {
        await scheduleTestAction(subject, { executeAt: pastTime })
      }

      await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()

      const executedActions = await getScheduledActions(subjects, ['executed'])
      expect(executedActions.length).toBe(3)

      for (const subject of subjects) {
        const modEvents = await getModerationEvents(subject, [
          'tools.ozone.moderation.defs#modEventTakedown',
        ])
        expect(modEvents.length).toBe(1)
      }
    })
  })
})
