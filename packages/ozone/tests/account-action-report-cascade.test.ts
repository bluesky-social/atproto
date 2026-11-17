import {
  ComAtprotoModerationDefs,
  ComAtprotoRepoStrongRef,
  ToolsOzoneModerationDefs,
  ids,
} from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { reportForEvent } from './_inbox.js'

describe('account action report cascade', () => {
  let network: TestNetwork
  let sc: SeedClient
  let mod: ModeratorClient
  let fixtureNumber = 0

  const headers = async (nsid: string) => ({
    headers: await network.ozone.modHeaders(nsid, 'admin'),
  })

  async function fixture() {
    const name = `accountcascade${++fixtureNumber}`
    const { did } = await sc.createAccount(name, {
      handle: `${name}.test`,
      email: `${name}@example.com`,
      password: 'password',
    })
    const post = await sc.post(did, 'Example post')
    const otherPost = await sc.post(did, 'Another post')
    return {
      did,
      account: { $type: 'com.atproto.admin.defs#repoRef', did },
      record: {
        $type: 'com.atproto.repo.strongRef',
        uri: post.ref.uriStr,
        cid: post.ref.cidStr,
      },
      otherRecord: {
        $type: 'com.atproto.repo.strongRef',
        uri: otherPost.ref.uriStr,
        cid: otherPost.ref.cidStr,
      },
      message: {
        $type: 'chat.bsky.convo.defs#messageRef',
        did,
        convoId: 'cascade-conversation',
        messageId: 'cascade-message',
      },
      conversation: {
        $type: 'chat.bsky.convo.defs#convoRef',
        did,
        convoId: 'cascade-conversation',
      },
    }
  }

  async function report(
    subject: Awaited<ReturnType<typeof fixture>>[
      'account' | 'record' | 'message' | 'conversation'],
    reasonType = ComAtprotoModerationDefs.REASONSPAM,
  ) {
    const event = await sc.createReport({
      subject,
      reasonType,
      reportedBy: sc.dids.carol,
    })
    await network.processAll()
    const key =
      'uri' in subject
        ? subject.uri
        : 'messageId' in subject
          ? `at://${subject.did}/chat.bsky.convo.message/${subject.messageId}`
          : 'convoId' in subject
            ? `at://${subject.did}/chat.bsky.convo/${subject.convoId}`
            : subject.did
    return {
      eventId: event.id,
      key,
      row: await reportForEvent(mod, event.id, key),
    }
  }

  async function activities(reportId: number) {
    return (
      await mod.agent.tools.ozone.report.listActivities(
        { reportId },
        await headers(ids.ToolsOzoneReportListActivities),
      )
    ).data.activities
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_account_action_report_cascade',
    })
    sc = network.getSeedClient()
    mod = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('links eligible account and owned reports to the takedown, preserving active reviews', async () => {
    const f = await fixture()
    const other = await fixture()
    const account = await report(f.account)
    const record = await report(f.record, ComAtprotoModerationDefs.REASONOTHER)
    const message = await report(f.message)
    const conversation = await report(f.conversation)
    const assigned = await report(f.otherRecord)
    const escalated = await report(
      f.otherRecord,
      ComAtprotoModerationDefs.REASONOTHER,
    )
    const unrelated = await report(other.account)

    await mod.agent.tools.ozone.report.assignModerator(
      {
        reportId: assigned.row.id,
        did: network.ozone.moderatorAccnt.did,
        isPermanent: true,
      },
      await headers(ids.ToolsOzoneReportAssignModerator),
    )
    await mod.agent.tools.ozone.report.createActivity(
      {
        reportId: escalated.row.id,
        activity: { $type: 'tools.ozone.report.defs#escalationActivity' },
      },
      await headers(ids.ToolsOzoneReportCreateActivity),
    )
    const action = await mod.emitEvent({
      subject: f.account,
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        acknowledgeAccountSubjects: true,
      },
      reportAction: {
        types: [ComAtprotoModerationDefs.REASONSPAM],
        isAutomated: true,
      },
      modTool: { name: 'test-automation', meta: { rules: 'test-rule' } },
    })

    for (const item of [account, record, message, conversation]) {
      const result = await reportForEvent(mod, item.eventId, item.key)
      expect(result.status).toBe('closed')
      expect(result.actionEventIds).toEqual([action.id])
      expect(await activities(item.row.id)).toContainEqual(
        expect.objectContaining({
          activity: expect.objectContaining({
            $type: 'tools.ozone.report.defs#closeActivity',
          }),
          isAutomated: true,
          meta: expect.objectContaining({
            resolution: 'linked',
            actionEventId: action.id,
            rules: 'test-rule',
          }),
        }),
      )
    }
    for (const [item, status] of [
      [assigned, 'assigned'],
      [escalated, 'escalated'],
      [unrelated, 'open'],
    ] as const) {
      const result = await reportForEvent(mod, item.eventId, item.key)
      expect(result.status).toBe(status)
      expect(result.actionEventIds).toBeNull()
    }
    const { subjectStatuses } = await mod.queryStatuses({
      subject: f.did,
      includeAllUserRecords: true,
    })
    const legacyStatus = subjectStatuses.find(
      (status) =>
        ComAtprotoRepoStrongRef.isMain(status.subject) &&
        status.subject.uri === f.otherRecord.uri,
    )
    expect(legacyStatus?.reviewState).toBe(
      ToolsOzoneModerationDefs.REVIEWCLOSED,
    )
    for (const subject of [f.record.uri, f.otherRecord.uri]) {
      const { events } = await mod.queryEvents({
        subject,
        types: ['tools.ozone.moderation.defs#modEventAcknowledge'],
      })
      expect(events).toHaveLength(1)
      expect(events[0].event).toMatchObject({
        comment: expect.stringContaining(`Account Event ID: ${action.id}`),
      })
    }
  })

  it('links the account acknowledgement to owned reports only when requested', async () => {
    const f = await fixture()
    const record = await report(f.record)
    await mod.emitEvent({
      subject: f.account,
      event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
    })
    expect((await reportForEvent(mod, record.eventId, record.key)).status).toBe(
      'open',
    )

    const action = await mod.emitEvent({
      subject: f.account,
      event: {
        $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
        acknowledgeAccountSubjects: true,
      },
    })
    const result = await reportForEvent(mod, record.eventId, record.key)
    expect(result.status).toBe('closed')
    expect(result.actionEventIds).toEqual([action.id])
    const { events } = await mod.queryEvents({
      subject: f.record.uri,
      types: ['tools.ozone.moderation.defs#modEventAcknowledge'],
    })
    expect(events).toHaveLength(1)
    expect(events[0].event).toMatchObject({
      comment: expect.stringContaining(`Account Event ID: ${action.id}`),
    })
  })

  it('links reports to a scheduled account takedown', async () => {
    const f = await fixture()
    const account = await report(f.account)
    const record = await report(f.record)
    await mod.agent.tools.ozone.moderation.scheduleAction(
      {
        action: {
          $type: 'tools.ozone.moderation.scheduleAction#takedown',
          acknowledgeAccountSubjects: true,
        },
        subjects: [f.did],
        createdBy: 'did:example:admin',
        scheduling: { executeAt: new Date(Date.now() - 1000).toISOString() },
        modTool: { name: 'test-automation' },
      },
      await headers(ids.ToolsOzoneModerationScheduleAction),
    )
    await network.ozone.daemon.ctx.scheduledActionProcessor.findAndExecuteScheduledActions()
    const { events } = await mod.queryEvents({
      subject: f.did,
      types: ['tools.ozone.moderation.defs#modEventTakedown'],
    })
    expect(events).toHaveLength(1)
    for (const item of [account, record]) {
      const result = await reportForEvent(mod, item.eventId, item.key)
      expect(result.status).toBe('closed')
      expect(result.actionEventIds).toEqual([events[0].id])
      expect(await activities(item.row.id)).toContainEqual(
        expect.objectContaining({
          activity: expect.objectContaining({
            $type: 'tools.ozone.report.defs#closeActivity',
          }),
          isAutomated: true,
          meta: expect.objectContaining({
            resolution: 'linked',
            actionEventId: events[0].id,
          }),
        }),
      )
    }
  })
})
