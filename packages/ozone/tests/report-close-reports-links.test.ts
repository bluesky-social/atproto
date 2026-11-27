import { sql } from 'kysely'
import { describe, expect, it } from 'vitest'
import { ComAtprotoModerationDefs, ids } from '@atproto/api'
import { chat, com, tools } from '../src/lexicons/index.js'
import {
  CHAT_CONVO_COLLECTION,
  CHAT_MESSAGE_COLLECTION,
} from '../src/mod-service/subject.js'
import { setupCloseReports } from './_close-reports.js'

const DEFS = 'tools.ozone.report.defs'

describe('report-close-reports links', () => {
  const t = setupCloseReports('ozone_report_close_reports_links')
  const {
    closeReports,
    listActivities,
    fixture,
    reports,
    report,
    detail,
    reopen,
    inbox,
    setStatus,
    snapshotReports,
    expectUnchanged,
    modHeaders,
  } = t

  const reportSubject = async (
    subject:
      | { $type: 'com.atproto.admin.defs#repoRef'; did: string }
      | { $type: 'com.atproto.repo.strongRef'; uri: string; cid: string },
    reasonType: string = ComAtprotoModerationDefs.REASONSPAM,
  ) => {
    await t.sc.createReport({
      reasonType,
      subject,
      reportedBy: t.sc.dids.bob,
    })
    await t.network.processAll()
  }

  const queryReports = async (params: {
    status: string
    subject?: string
    did?: string
  }) => {
    const { data } = await t.agent.tools.ozone.report.queryReports(params, {
      headers: await modHeaders(ids.ToolsOzoneReportQueryReports),
    })
    return data.reports
  }

  it('links an account action to eligible closures across all owned subjects', async () => {
    const f = await fixture()
    const foreign = await fixture()
    const [s1, s2, s3, s4, assigned, other, untouched] = await reports([
      f.account,
      f.record,
      f.message,
      f.conversation,
      f.record,
      { subject: f.record, reasonType: com.atproto.moderation.defs.ReasonRude },
      foreign.account,
    ])
    const selected = [s1, s2, s3, s4]
    await setStatus(assigned.id, 'assigned')
    const action = await t.network.ozone.getModClient().emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
    })

    const result = await closeReports({
      subject: f.did,
      includeAllOwned: true,
      reportTypes: [com.atproto.moderation.defs.ReasonSpam],
      actionEventId: action.id,
      internalNote: 'Reviewed',
      meta: { source: 'test', actionEventId: 999, resolution: 'noAction' },
    })
    expect(result.data.reportIds.sort()).toEqual(
      selected.map((r) => r.id).sort(),
    )
    for (const r of selected) {
      expect((await detail(r.id)).actionEventIds).toEqual([action.id])
      expect(await listActivities(r.id)).toContainEqual(
        expect.objectContaining({
          internalNote: 'Reviewed',
          meta: {
            source: 'test',
            resolution: 'linked',
            actionEventId: action.id,
          },
        }),
      )
    }
    expect((await inbox(selected[0].id)).resolution?.outcome).toBe(
      'actionTaken',
    )
    expect((await inbox(selected[1].id)).resolution?.outcome).toBe(
      'actionTaken',
    )
    for (const r of [assigned, other, untouched]) {
      expect((await detail(r.id)).status).not.toBe('closed')
    }

    await reopen(selected[1].id)
    await closeReports({ subject: f.record.uri, actionEventId: action.id })
    expect((await detail(selected[1].id)).actionEventIds).toEqual([action.id])
  })

  it('rejects missing, unrelated, and non-closing action events without closing reports', async () => {
    const f = await fixture()
    const foreign = await fixture()
    const selected = await report(f.record)
    const before = await snapshotReports([selected])
    const mod = t.network.ozone.getModClient()
    const unrelated = await mod.emitEvent({
      subject: foreign.account,
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
    })
    const otherPost = await t.sc.post(f.did, 'Another record')
    await t.network.processAll()
    const wrongRecord = await mod.emitEvent({
      subject: com.atproto.repo.strongRef.$build({
        uri: otherPost.ref.uriStr,
        cid: otherPost.ref.cidStr,
      }),
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
    })
    const nonClosing = await mod.emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventEscalate.$build({}),
    })
    for (const actionEventId of [
      999999999,
      unrelated.id,
      wrongRecord.id,
      nonClosing.id,
    ]) {
      await expect(
        closeReports({ subject: f.record.uri, actionEventId }),
      ).rejects.toMatchObject({
        error: 'InvalidRequest',
      })
    }
    const recordEvent = await mod.emitEvent({
      subject: f.record,
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
    })
    await expect(
      closeReports({
        subject: f.did,
        includeAllOwned: true,
        actionEventId: recordEvent.id,
      }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
    await expectUnchanged(before)
  })

  it.each(['message', 'conversation'] as const)(
    'links an event on the exact %s subject',
    async (kind) => {
      const f = await fixture()
      const foreign = await fixture()
      const [selected, untouched] = await reports([f[kind], foreign[kind]])
      const subject =
        kind === 'message'
          ? `at://${f.did}/${CHAT_MESSAGE_COLLECTION}/${f.message.messageId}`
          : `at://${f.did}/${CHAT_CONVO_COLLECTION}/${f.conversation.convoId}`
      const mod = t.network.ozone.getModClient()
      const wrongSubject =
        kind === 'message'
          ? chat.bsky.convo.defs.messageRef.$build({
              ...f.message,
              messageId: 'different-message',
            })
          : chat.bsky.convo.defs.convoRef.$build({
              ...f.conversation,
              convoId: 'different-conversation',
            })
      const wrongEvent = await mod.emitEvent({
        subject: wrongSubject,
        event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
      })
      const foreignEvent = await mod.emitEvent({
        subject: foreign[kind],
        event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
      })
      const action = await mod.emitEvent({
        subject: f[kind],
        event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
      })
      for (const actionEventId of [wrongEvent.id, foreignEvent.id]) {
        await expect(
          closeReports({ subject, actionEventId }),
        ).rejects.toMatchObject({
          error: 'InvalidRequest',
        })
      }
      await expect(
        closeReports({
          subject: f.did,
          includeAllOwned: true,
          actionEventId: action.id,
        }),
      ).rejects.toMatchObject({ error: 'InvalidRequest' })

      expect(
        (await closeReports({ subject, actionEventId: action.id })).data,
      ).toEqual({
        closedCount: 1,
        reportIds: [selected.id],
      })
      expect((await detail(selected.id)).actionEventIds).toEqual([action.id])
      expect(await listActivities(selected.id)).toContainEqual(
        expect.objectContaining({
          meta: { resolution: 'linked', actionEventId: action.id },
        }),
      )
      expect((await detail(untouched.id)).status).toBe('open')
    },
  )

  it('uses the current message report to distinguish conversations', async () => {
    const f = await fixture()
    const otherMessage = chat.bsky.convo.defs.messageRef.$build({
      ...f.message,
      convoId: 'other-conversation',
    })
    const [current, matching, other] = await reports([
      {
        subject: f.message,
        reasonType: com.atproto.moderation.defs.ReasonRude,
      },
      f.message,
      otherMessage,
    ])
    await setStatus(current.id, 'assigned')
    const action = await t.network.ozone.getModClient().emitEvent({
      subject: otherMessage,
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
    })
    const input = {
      subject: `at://${f.did}/${CHAT_MESSAGE_COLLECTION}/${f.message.messageId}`,
      reportId: current.id,
      reportTypes: [com.atproto.moderation.defs.ReasonSpam],
    }

    await expect(
      closeReports({ ...input, actionEventId: action.id }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
    expect((await closeReports(input)).data).toEqual({
      closedCount: 2,
      reportIds: [current.id, matching.id],
    })
    expect((await detail(other.id)).status).toBe('open')
  })

  it('does not link a message event to the same message ID in another conversation', async () => {
    const f = await fixture()
    const [selected, other] = await reports([
      f.message,
      chat.bsky.convo.defs.messageRef.$build({
        ...f.message,
        convoId: 'other-conversation',
      }),
    ])
    const action = await t.network.ozone.getModClient().emitEvent({
      subject: f.message,
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
    })
    expect(
      (
        await closeReports({
          subject: `at://${f.did}/${CHAT_MESSAGE_COLLECTION}/${f.message.messageId}`,
          actionEventId: action.id,
        })
      ).data,
    ).toEqual({ closedCount: 1, reportIds: [selected.id] })
    expect((await detail(selected.id)).actionEventIds).toEqual([action.id])
    expect((await detail(other.id)).status).toBe('open')
    expect(await listActivities(other.id)).toHaveLength(0)
  })

  it('links an older action even when it was reversed before the report', async () => {
    const f = await fixture()
    const mod = t.network.ozone.getModClient()
    const action = await mod.emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
    })
    await mod.emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: [],
        negateLabelVals: ['spam'],
      }),
    })
    const selected = await report(f.account)
    expect(action.id).toBeLessThan(selected.eventId)
    expect(
      (await closeReports({ subject: f.did, actionEventId: action.id })).data,
    ).toEqual({
      closedCount: 1,
      reportIds: [selected.id],
    })
    expect((await detail(selected.id)).actionEventIds).toEqual([action.id])
    expect((await inbox(selected.id)).resolution?.outcome).toBe('actionTaken')
  })

  it('links one emitted account event to all owned reports and preserves active review', async () => {
    const f = await fixture()
    const foreign = await fixture()
    const [s1, s2, s3, s4, explicit, assigned, escalated, untouched] =
      await reports([
        f.account,
        f.record,
        f.message,
        f.conversation,
        f.record,
        f.record,
        f.account,
        foreign.account,
      ])
    const selected = [s1, s2, s3, s4]
    await setStatus(explicit.id, 'assigned')
    await setStatus(assigned.id, 'assigned')
    await setStatus(escalated.id, 'escalated')
    const action = await t.network.ozone.getModClient().emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { allOwned: true, ids: [explicit.id] },
    })
    for (const r of [...selected, explicit]) {
      const view = await detail(r.id)
      expect(view.status).toBe('closed')
      expect(view.actionEventIds).toEqual([action.id])
      expect(await listActivities(r.id)).toContainEqual(
        expect.objectContaining({
          meta: { resolution: 'linked', actionEventId: action.id },
        }),
      )
    }
    for (const r of [assigned, escalated, untouched]) {
      expect((await detail(r.id)).status).not.toBe('closed')
    }
  })

  it('rejects allOwned on records and events that do not close reports', async () => {
    const f = await fixture()
    const selected = await report(f.record)
    const before = await snapshotReports([selected])
    const mod = t.network.ozone.getModClient()
    await expect(
      mod.emitEvent({
        subject: f.record,
        event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
        reportAction: { allOwned: true },
      }),
    ).rejects.toThrow('allOwned requires an account subject')
    await expect(
      mod.emitEvent({
        subject: f.account,
        event: tools.ozone.moderation.defs.modEventEscalate.$build({}),
        reportAction: { allOwned: true },
      }),
    ).rejects.toThrow('allOwned requires an event that closes reports')
    await expectUnchanged(before)
  })

  it('accepts allOwned as the only target and links record actions on exact subjects', async () => {
    const f = await fixture()
    const recordReport = await report(f.record)
    const recordAction = await t.network.ozone.getModClient().emitEvent({
      subject: f.record,
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
    })
    await closeReports({
      subject: f.record.uri,
      actionEventId: recordAction.id,
    })
    expect((await detail(recordReport.id)).actionEventIds).toEqual([
      recordAction.id,
    ])

    await reopen(recordReport.id)
    const accountAction = await t.network.ozone.getModClient().emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { allOwned: true },
    })
    const view = await detail(recordReport.id)
    expect(view.status).toBe('closed')
    expect(view.actionEventIds).toEqual([recordAction.id, accountAction.id])
  })

  it('associates selected reasons with enforcement and excludes reasons from cleanup', async () => {
    const f = await fixture()
    const [actioned, excluded, ...remaining] = await reports([
      f.account,
      {
        subject: f.account,
        reasonType: com.atproto.moderation.defs.ReasonMisleading,
      },
      {
        subject: f.account,
        reasonType: com.atproto.moderation.defs.ReasonRude,
      },
      { subject: f.record, reasonType: com.atproto.moderation.defs.ReasonRude },
    ])
    const action = await t.network.ozone.getModClient().emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventTakedown.$build({
        durationInHours: 24,
      }),
      reportAction: { types: [com.atproto.moderation.defs.ReasonSpam] },
    })
    expect(
      (
        await closeReports({
          subject: f.did,
          includeAllOwned: true,
          excludedReportTypes: [
            com.atproto.moderation.defs.ReasonSpam,
            com.atproto.moderation.defs.ReasonMisleading,
          ],
        })
      ).data.reportIds.sort(),
    ).toEqual(remaining.map((r) => r.id).sort())
    expect((await detail(actioned.id)).actionEventIds).toEqual([action.id])
    expect((await inbox(actioned.id)).resolution?.outcome).toBe('actionTaken')
    expect((await detail(excluded.id)).status).toBe('open')
    expect(await listActivities(excluded.id)).toHaveLength(0)
    for (const r of remaining) {
      expect((await detail(r.id)).actionEventIds ?? []).toEqual([])
      expect((await inbox(r.id)).resolution?.outcome).toBe('noAction')
    }
  })

  it('preserves old action links while counting the current closure as no-action', async () => {
    const f = await fixture()
    const reason = tools.ozone.report.defs.ReasonMisleadingBot
    const r = await report(f.record, reason)
    const mod = t.network.ozone.getModClient()
    const queue = (
      await t.agent.tools.ozone.queue.createQueue(
        { name: 'Closure history', subjectTypes: [], reportTypes: [reason] },
        { headers: await modHeaders(ids.ToolsOzoneQueueCreateQueue) },
      )
    ).data.queue
    await t.agent.tools.ozone.report.reassignQueue(
      { reportId: r.id, queueId: queue.id },
      { headers: await modHeaders(ids.ToolsOzoneReportReassignQueue) },
    )
    const label = await mod.emitEvent({
      subject: f.record,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { ids: [r.id] },
    })
    await reopen(r.id)
    await closeReports({ subject: f.did, includeAllOwned: true })
    expect((await detail(r.id)).actionEventIds).toEqual([label.id])
    expect((await inbox(r.id)).resolution?.outcome).toBe('noAction')
    const stats = async () => {
      await mod.computeStats()
      return (
        await t.agent.tools.ozone.report.getLiveStats(
          { queueId: queue.id },
          { headers: await modHeaders(ids.ToolsOzoneReportGetLiveStats) },
        )
      ).data.stats
    }
    expect(await stats()).toMatchObject({
      closedCount: 1,
      actionedCount: 0,
      acknowledgedCount: 1,
      labelActionCount: 0,
    })
    await reopen(r.id)
    await mod.emitEvent({
      subject: f.record,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { ids: [r.id] },
    })
    expect(await stats()).toMatchObject({
      closedCount: 1,
      actionedCount: 1,
      acknowledgedCount: 0,
      labelActionCount: 1,
    })
  })

  it('does not duplicate activities during concurrent cleanup', async () => {
    const f = await fixture()
    const created = await reports([f.account, f.record])
    const input = { subject: f.did, includeAllOwned: true }
    const results = await Promise.all([
      closeReports(input),
      closeReports(input),
    ])
    expect(
      results.reduce((count, result) => count + result.data.closedCount, 0),
    ).toBe(created.length)
    for (const r of created) expect(await listActivities(r.id)).toHaveLength(1)
  })

  it('closes all open reports on an account subject', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: t.sc.dids.alice },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: t.sc.dids.alice },
      ComAtprotoModerationDefs.REASONRUDE,
    )

    const openBefore = await queryReports({
      status: 'open',
      subject: t.sc.dids.alice,
    })
    expect(openBefore.length).toBeGreaterThanOrEqual(2)

    const { data } = await closeReports({
      subject: t.sc.dids.alice,
      internalNote: 'Auto-closed by rules engine.',
      isAutomated: true,
    })

    expect(data.closedCount).toBe(openBefore.length)
    expect(data.reportIds.sort()).toEqual(openBefore.map((r) => r.id).sort())

    const openAfter = await queryReports({
      status: 'open',
      subject: t.sc.dids.alice,
    })
    expect(openAfter).toHaveLength(0)

    // Each closed report gets a closeActivity with the note + isAutomated
    for (const reportId of data.reportIds) {
      const activities = await listActivities(reportId)
      const close = activities.find(
        (a) => a.activity.$type === `${DEFS}#closeActivity`,
      )
      expect(close).toBeDefined()
      expect(close!.internalNote).toBe('Auto-closed by rules engine.')
      expect(close!.isAutomated).toBe(true)
    }
  })

  it('filters by report types', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: t.sc.dids.carol },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: t.sc.dids.carol },
      ComAtprotoModerationDefs.REASONMISLEADING,
    )

    const { data } = await closeReports({
      subject: t.sc.dids.carol,
      reportTypes: [ComAtprotoModerationDefs.REASONSPAM],
    })
    expect(data.closedCount).toBe(1)

    const stillOpen = await queryReports({
      status: 'open',
      subject: t.sc.dids.carol,
    })
    expect(stillOpen).toHaveLength(1)
    expect(stillOpen[0].reportType).toBe(
      ComAtprotoModerationDefs.REASONMISLEADING,
    )
  })

  it('scopes to record-level reports when subject is an AT-URI', async () => {
    const post = t.sc.posts[t.sc.dids.alice][0].ref
    await reportSubject(
      {
        $type: 'com.atproto.repo.strongRef',
        uri: post.uriStr,
        cid: post.cidStr,
      },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    // account-level report on the same DID should not be touched
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: t.sc.dids.alice },
      ComAtprotoModerationDefs.REASONSPAM,
    )

    const { data } = await closeReports({ subject: post.uriStr })
    expect(data.closedCount).toBe(1)

    const accountReports = await queryReports({
      status: 'open',
      subject: t.sc.dids.alice,
    })
    expect(accountReports).toHaveLength(1)
  })

  it('scopes message, conversation, and account reports independently', async () => {
    const convoId = 'close-reports-convo'
    const messageId = 'close-reports-message'
    const convoUri = `at://${t.sc.dids.dan}/chat.bsky.convo/${convoId}`
    const messageUri = `at://${t.sc.dids.dan}/chat.bsky.convo.message/${messageId}`

    await t.sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: {
        $type: 'chat.bsky.convo.defs#messageRef',
        did: t.sc.dids.dan,
        convoId,
        messageId,
      },
      reportedBy: t.sc.dids.bob,
    })
    await t.sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: {
        $type: 'chat.bsky.convo.defs#convoRef',
        did: t.sc.dids.dan,
        convoId,
      },
      reportedBy: t.sc.dids.bob,
    })
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: t.sc.dids.dan },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    await t.network.processAll()

    const accountResult = await closeReports({ subject: t.sc.dids.dan })
    expect(accountResult.data.closedCount).toBe(1)

    const messageResult = await closeReports({ subject: messageUri })
    expect(messageResult.data.closedCount).toBe(1)

    const convoResult = await closeReports({ subject: convoUri })
    expect(convoResult.data.closedCount).toBe(1)
  })

  it('returns zero when no reports match', async () => {
    const { data } = await closeReports({
      subject: 'did:plc:doesnotexistanywhere',
    })
    expect(data.closedCount).toBe(0)
    expect(data.reportIds).toEqual([])
  })

  it('rejects a subject that is neither a DID nor an AT-URI', async () => {
    await expect(
      closeReports({ subject: 'https://example.com' }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
  })

  it('closes queued reports too', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: t.sc.dids.dan },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    const [report] = await queryReports({
      status: 'open',
      subject: t.sc.dids.dan,
    })
    await t.agent.tools.ozone.report.createActivity(
      {
        reportId: report.id,
        activity: { $type: `${DEFS}#queueActivity` },
      },
      {
        encoding: 'application/json',
        headers: await t.network.ozone.modHeaders(
          ids.ToolsOzoneReportCreateActivity,
          'admin',
        ),
      },
    )

    const { data } = await closeReports({ subject: t.sc.dids.dan })
    expect(data.closedCount).toBe(1)
    expect(data.reportIds).toEqual([report.id])
  })
  it('links account actions across multiple report update batches', async () => {
    const f = await fixture()
    const template = await report(f.record)
    const db = t.network.ozone.ctx.db
    // @NOTE Bulk fixtures exercise the event-linked update batches directly.
    await sql`
      with events as (
        insert into moderation_event (action, "subjectType", "subjectDid", "subjectUri", "subjectCid", "createdAt", "createdBy", meta)
        select action, "subjectType", "subjectDid", "subjectUri", "subjectCid", "createdAt", "createdBy", meta
        from moderation_event cross join generate_series(1, 505)
        where id = ${template.eventId}
        returning id
      )
      insert into report ("eventId", did, "reporterDid", "recordPath", "reportType", status, "createdAt", "updatedAt", "queueId", "isMuted", "isAutomated")
      select events.id, r.did, r."reporterDid", r."recordPath", r."reportType", r.status, r."createdAt", r."updatedAt", -1, false, false
      from events cross join report r where r.id = ${template.id}
    `.execute(db.db)
    // Drain the router's 100-event batches so synthetic events cannot delay
    // routing reports created by subsequent tests.
    for (let i = 0; i < 6; i++) {
      await t.network.ozone.daemon.ctx.queueRouter.routeReports()
    }
    const action = await t.network.ozone.getModClient().emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { allOwned: true },
    })
    const counts = await sql<{ reports: number; activities: number }>`
      select count(*)::int as reports,
        count(*) filter (where a.meta ->> 'actionEventId' = ${String(action.id)})::int as activities
      from report r join report_activity a on a."reportId" = r.id
      where r.did = ${f.did} and r.status = 'closed'
        and r."actionEventIds" @> ${JSON.stringify([action.id])}::jsonb
    `.execute(db.db)
    expect(counts.rows[0]).toEqual({ reports: 506, activities: 506 })
  })

  it('closes thousands of reports atomically within SQL parameter limits', async () => {
    const f = await fixture()
    const template = await report(f.record)
    const db = t.network.ozone.ctx.db
    const meta = {
      source: 'example-worker',
      rules: [{ name: 'example/cleanup', version: 1 }],
      custom: { batch: 'example-batch' },
    }
    // @NOTE Bulk database fixtures exercise the protocol parameter limit directly.
    await sql`
      with events as (
        insert into moderation_event (action, "subjectType", "subjectDid", "subjectUri", "subjectCid", "createdAt", "createdBy", meta)
        select action, "subjectType", "subjectDid", "subjectUri", "subjectCid", "createdAt", "createdBy", meta
        from moderation_event cross join generate_series(1, 7000)
        where id = ${template.eventId}
        returning id
      )
      insert into report ("eventId", did, "reporterDid", "recordPath", "reportType", status, "createdAt", "updatedAt", "queueId", "isMuted", "isAutomated")
      select events.id, r.did, r."reporterDid", r."recordPath", r."reportType", r.status, r."createdAt", r."updatedAt", -1, false, false
      from events cross join report r where r.id = ${template.id}
    `.execute(db.db)
    // @NOTE Refresh planner statistics; plans chosen for a near-empty table
    // make closing the bulk rows several times slower.
    await sql`analyze report, moderation_event`.execute(db.db)
    const lastReport = await db.db
      .selectFrom('report')
      .select('id')
      .where('did', '=', f.did)
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirstOrThrow()
    await sql`create function fail_close_batch() returns trigger language plpgsql as $$ begin raise exception 'Injected close batch failure'; end $$`.execute(
      db.db,
    )
    await sql`create trigger fail_close_batch before insert on report_activity for each row when (new."reportId" = ${sql.lit(lastReport.id)}) execute function fail_close_batch()`.execute(
      db.db,
    )
    try {
      await expect(
        closeReports({ subject: f.did, includeAllOwned: true, meta }),
      ).rejects.toThrow()
      const closed = await db.db
        .selectFrom('report')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('did', '=', f.did)
        .where('status', '=', 'closed')
        .executeTakeFirstOrThrow()
      expect(closed.count).toBe(0)
      expect(await listActivities(template.id)).toHaveLength(0)
    } finally {
      await sql`drop trigger fail_close_batch on report_activity`.execute(db.db)
      await sql`drop function fail_close_batch()`.execute(db.db)
    }
    const { data } = await closeReports({
      subject: f.did,
      includeAllOwned: true,
      meta,
    })
    expect(data.closedCount).toBe(7001)
    expect(new Set(data.reportIds).size).toBe(7001)
    const counts = await db.db
      .selectFrom('report_activity')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('reportId', 'in', data.reportIds)
      .executeTakeFirstOrThrow()
    expect(counts.count).toBe(7001)
    expect((await listActivities(template.id))[0].meta).toEqual({
      ...meta,
      resolution: 'noAction',
    })
    expect(
      (await closeReports({ subject: f.did, includeAllOwned: true })).data
        .closedCount,
    ).toBe(0)
  })
})
