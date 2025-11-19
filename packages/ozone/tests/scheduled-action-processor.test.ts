import {
  AtpAgent,
  ToolsOzoneModerationListScheduledActions,
} from '@atproto/api'
import { HOUR, MINUTE } from '@atproto/common'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ModEventTakedown } from '../dist/lexicon/types/tools/ozone/moderation/defs'
import { ids } from '../src/lexicon/lexicons'
import { ProtectedTagSettingKey } from '../src/setting/constants'

describe('scheduled action processor', () => {
  let network: TestNetwork
  let adminAgent: AtpAgent
  let sc: SeedClient

  const getAdminHeaders = async (route: string) => {
    return {
      headers: await network.ozone.modHeaders(route, 'admin'),
    }
  }

  const scheduleTestAction = async (
    subject: string,
    scheduling: any,
    emailData?: { emailSubject?: string; emailContent?: string },
  ) => {
    return await adminAgent.tools.ozone.moderation.scheduleAction(
      {
        action: {
          $type: 'tools.ozone.moderation.scheduleAction#takedown',
          comment: 'Test scheduled takedown',
          policies: ['spam'],
          severityLevel: 'sev-1',
          strikeCount: 1,
          ...emailData,
        },
        subjects: [subject],
        createdBy: 'did:plc:moderator',
        scheduling,
      },
      await getAdminHeaders(ids.ToolsOzoneModerationScheduleAction),
    )
  }

  const getScheduledActions = async (
    statuses: ToolsOzoneModerationListScheduledActions.InputSchema['statuses'],
    subjects?: string[],
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
      await scheduleTestAction(
        testSubject,
        { executeAt: pastTime },
        {
          emailSubject: 'Test Email Subject',
          emailContent: 'Test Email Content',
        },
      )

      const pendingActions = await getScheduledActions(
        ['pending'],
        [testSubject],
      )
      expect(pendingActions.length).toBe(1)

      await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()

      const executedActions = await getScheduledActions(
        ['executed'],
        [testSubject],
      )
      expect(executedActions.length).toBe(1)
      expect(executedActions[0].status).toBe('executed')
      expect(executedActions[0].executionEventId).toBeDefined()

      const modEvents = await getModerationEvents(testSubject, [
        'tools.ozone.moderation.defs#modEventTakedown',
        'tools.ozone.moderation.defs#modEventEmail',
      ])
      expect(modEvents.length).toBe(2)
      const takedownEvent = modEvents.find(
        (e) => e.event.$type === 'tools.ozone.moderation.defs#modEventTakedown',
      )
      const emailEvent = modEvents.find(
        (e) => e.event.$type === 'tools.ozone.moderation.defs#modEventEmail',
      )

      expect(takedownEvent?.event['comment']).toBeDefined()

      expect(emailEvent?.event['subjectLine']).toBe('Test Email Subject')
      expect(emailEvent?.event['content']).toBe('Test Email Content')
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
        ['pending'],
        [testSubject],
      )
      expect(pendingActions.length).toBe(1)

      const executedActions = await getScheduledActions(
        ['executed'],
        [testSubject],
      )
      expect(executedActions.length).toBe(0)
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
        ['pending'],
        [testSubject],
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
        ['executed'],
        [testSubject],
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
        'tools.ozone.moderation.defs#modEventEmail',
      ])
      // No email was sent
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
        ['pending'],
        [testSubject],
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

      const failedActions = await getScheduledActions(['failed'], [testSubject])
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
        ['cancelled'],
        [testSubject],
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

      const executedActions = await getScheduledActions(['executed'], subjects)
      expect(executedActions.length).toBe(3)

      for (const subject of subjects) {
        const modEvents = await getModerationEvents(subject, [
          'tools.ozone.moderation.defs#modEventTakedown',
        ])
        expect(modEvents.length).toBe(1)
      }
    })
  })

  describe('takedown validation checks', () => {
    it('fails when trying to takedown an already taken down account', async () => {
      const testSubject = 'did:plc:already_takendown'

      // takedown the account manually
      await adminAgent.tools.ozone.moderation.emitEvent(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: testSubject,
          },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTakedown',
            comment: 'Manual takedown first',
          },
          createdBy: adminAgent.session?.did || 'did:plc:admin',
        },
        await getAdminHeaders(ids.ToolsOzoneModerationEmitEvent),
      )

      // Schedule a takedown for the already taken down account
      await scheduleTestAction(testSubject, {
        executeAt: new Date(Date.now() - 1000).toISOString(),
      })

      // Process the scheduled action
      await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()

      // Verify the scheduled action failed
      const failedActions = await getScheduledActions(['failed'], [testSubject])
      expect(failedActions.length).toBe(1)
      expect(failedActions[0].status).toBe('failed')
      expect(failedActions[0].lastFailureReason).toContain(
        'Account is already taken down',
      )
    })

    it('enforces protected tag restrictions when account has protected tags', async () => {
      const testSubject = 'did:plc:protected_tag_test'

      // add the protected tag to the account
      await adminAgent.tools.ozone.moderation.emitEvent(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: testSubject,
          },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: ['vip'],
            remove: [],
          },
          createdBy: adminAgent.session?.did || 'did:plc:admin',
        },
        await getAdminHeaders(ids.ToolsOzoneModerationEmitEvent),
      )

      // add protected tag setting for the instance and make that tag actionable by a mod only
      await adminAgent.tools.ozone.setting.upsertOption(
        {
          key: ProtectedTagSettingKey,
          scope: 'instance',
          managerRole: 'tools.ozone.team.defs#roleAdmin',
          value: { vip: { moderators: [sc.dids.alice] } },
        },
        await getAdminHeaders(ids.ToolsOzoneSettingUpsertOption),
      )

      // Schedule a takedown action created by a non-admin moderator
      await adminAgent.tools.ozone.moderation.scheduleAction(
        {
          action: {
            $type: 'tools.ozone.moderation.scheduleAction#takedown',
            comment: 'Test protected tag enforcement',
          },
          subjects: [testSubject],
          createdBy: 'did:plc:non_admin_moderator', // Non-admin creator
          scheduling: {
            executeAt: new Date(Date.now() - 1000).toISOString(),
          },
        },
        await getAdminHeaders(ids.ToolsOzoneModerationScheduleAction),
      )

      // Process the scheduled action
      await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()

      // Verify the scheduled action failed due to protected tag restrictions
      const failedActions = await getScheduledActions(['failed'], [testSubject])
      expect(failedActions.length).toBe(1)
      expect(failedActions[0].status).toBe('failed')
      expect(failedActions[0].lastFailureReason).toContain('tag')

      // Clean up protected tags setting
      await adminAgent.tools.ozone.setting.removeOptions(
        {
          keys: [ProtectedTagSettingKey],
          scope: 'instance',
        },
        await getAdminHeaders(ids.ToolsOzoneSettingRemoveOptions),
      )
    })

    it('allows takedown of accounts with protected tags when created by authorized user', async () => {
      const testSubject = 'did:plc:authorized_protected_tag_test'

      // Set up protected tags configuration allowing admins
      await adminAgent.tools.ozone.setting.upsertOption(
        {
          key: ProtectedTagSettingKey,
          scope: 'instance',
          managerRole: 'tools.ozone.team.defs#roleAdmin',
          value: { vip: { roles: ['tools.ozone.team.defs#roleAdmin'] } },
        },
        await getAdminHeaders(ids.ToolsOzoneSettingUpsertOption),
      )

      // Add a protected tag to the account
      await adminAgent.tools.ozone.moderation.emitEvent(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: testSubject,
          },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: ['vip'],
            remove: [],
          },
          createdBy: adminAgent.session?.did || 'did:plc:admin',
        },
        await getAdminHeaders(ids.ToolsOzoneModerationEmitEvent),
      )

      await adminAgent.tools.ozone.moderation.scheduleAction(
        {
          action: {
            $type: 'tools.ozone.moderation.scheduleAction#takedown',
            comment: 'Admin takedown of protected account',
          },
          subjects: [testSubject],
          createdBy: network.ozone.ctx.cfg.service.did,
          scheduling: {
            executeAt: new Date(Date.now() - 1000).toISOString(),
          },
        },
        await getAdminHeaders(ids.ToolsOzoneModerationScheduleAction),
      )

      await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()

      const executedActions = await getScheduledActions(
        ['executed'],
        [testSubject],
      )
      expect(executedActions.length).toBe(1)
      expect(executedActions[0].status).toBe('executed')

      const modEvents = await getModerationEvents(testSubject, [
        'tools.ozone.moderation.defs#modEventTakedown',
      ])
      expect(modEvents.length).toBe(1)
    })
  })
})
