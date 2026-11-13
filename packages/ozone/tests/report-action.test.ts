import { ComAtprotoModerationDefs } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'

describe('report-action', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_action',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  beforeEach(async () => {
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  describe('emitEvent with reportAction', () => {
    it('actions only the selected message report', async () => {
      const did = sc.dids.carol
      const message = {
        $type: 'chat.bsky.convo.defs#messageRef',
        did,
        convoId: 'report-action-convo',
        messageId: 'report-action-message',
      }
      const otherMessage = { ...message, messageId: 'report-action-other' }
      const conversation = {
        $type: 'chat.bsky.convo.defs#convoRef',
        did,
        convoId: message.convoId,
      }
      const account = { $type: 'com.atproto.admin.defs#repoRef', did }
      for (const subject of [message, otherMessage, conversation, account]) {
        await sc.createReport({
          reasonType: ComAtprotoModerationDefs.REASONSPAM,
          subject,
          reportedBy: sc.dids.alice,
        })
      }
      await network.processAll()

      const uri = `at://${did}/chat.bsky.convo.message/${message.messageId}`
      const otherUri = `at://${did}/chat.bsky.convo.message/${otherMessage.messageId}`
      const convoUri = `at://${did}/chat.bsky.convo/${conversation.convoId}`
      const target = await modClient.queryReports({
        status: 'open',
        subject: uri,
      })
      expect(target.reports).toHaveLength(1)
      expect(target.reports[0].subject.status?.subject).toMatchObject(message)
      await expect(
        modClient.emitEvent({
          subject: message,
          event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
          reportAction: { ids: [target.reports[0].id] },
        }),
      ).rejects.toThrow('Message takedowns are not supported')
      expect(
        (await modClient.queryReports({ status: 'open', subject: uri }))
          .reports,
      ).toHaveLength(1)
      const messageEvents = await modClient.queryEvents({ subject: uri })
      expect(messageEvents.events.length).toBeGreaterThan(0)
      for (const event of messageEvents.events)
        expect(event.subject).toEqual(message)
      const convoEvents = await modClient.queryEvents({ subject: convoUri })
      expect(convoEvents.events.length).toBeGreaterThan(0)
      for (const event of convoEvents.events)
        expect(event.subject).toEqual(conversation)
      await modClient.emitEvent({
        subject: message,
        event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
        reportAction: { ids: [target.reports[0].id] },
      })

      expect(
        (
          await modClient.queryReports({ status: 'closed', subject: uri })
        ).reports.map((report) => report.id),
      ).toContain(target.reports[0].id)
      const closed = await modClient.queryReports({
        status: 'closed',
        subject: uri,
      })
      const closedReport = closed.reports.find(
        (report) => report.id === target.reports[0].id,
      )
      expect(closedReport?.subject.status?.reviewState).toBe(
        'tools.ozone.moderation.defs#reviewClosed',
      )
      expect(closedReport?.subject.status?.subject).toMatchObject(message)
      for (const subject of [otherUri, convoUri, did]) {
        expect(
          (await modClient.queryReports({ status: 'open', subject })).reports
            .length,
        ).toBeGreaterThan(0)
      }
      const messageStatus = await modClient.queryStatuses({ subject: uri })
      expect(messageStatus.subjectStatuses).toHaveLength(1)
      expect(messageStatus.subjectStatuses[0].subject).toMatchObject({
        $type: 'chat.bsky.convo.defs#messageRef',
        did,
        convoId: message.convoId,
        messageId: message.messageId,
      })
      expect(messageStatus.subjectStatuses[0].reviewState).toBe(
        'tools.ozone.moderation.defs#reviewClosed',
      )
      for (const subject of [otherUri, convoUri, did]) {
        const status = await modClient.queryStatuses({ subject })
        expect(status.subjectStatuses[0].reviewState).toBe(
          'tools.ozone.moderation.defs#reviewOpen',
        )
      }
      const sameIdOtherConvo = { ...message, convoId: 'another-conversation' }
      await sc.createReport({
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: message,
        reportedBy: sc.dids.alice,
      })
      await network.processAll()
      const sameConvo = await modClient.queryReports({
        status: 'open',
        subject: uri,
      })
      expect(sameConvo.reports).toHaveLength(1)
      await sc.createReport({
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: sameIdOtherConvo,
        reportedBy: sc.dids.alice,
      })
      await network.processAll()
      const both = await modClient.queryReports({
        status: 'open',
        subject: uri,
      })
      expect(both.reports).toHaveLength(2)
      const statuses = await modClient.queryStatuses({ subject: uri })
      expect(statuses.subjectStatuses.map((status) => status.subject)).toEqual(
        expect.arrayContaining([message, sameIdOtherConvo]),
      )
      const foreignId = both.reports.find(
        (report) => report.id !== sameConvo.reports[0].id,
      )!.id
      expect(
        both.reports.find((report) => report.id === sameConvo.reports[0].id)
          ?.subject.status?.subject,
      ).toMatchObject(message)
      expect(
        both.reports.find((report) => report.id === foreignId)?.subject.status
          ?.subject,
      ).toMatchObject(sameIdOtherConvo)
      await modClient.emitEvent({
        subject: message,
        event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
        reportAction: { all: true },
      })
      expect(
        (
          await modClient.queryReports({ status: 'open', subject: uri })
        ).reports.map((report) => report.id),
      ).toEqual([foreignId])

      await expect(
        modClient.emitEvent({
          subject: message,
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel',
            createLabelVals: ['message-test-label'],
            negateLabelVals: [],
          },
        }),
      ).rejects.toThrow('Message labels are not supported')
      await expect(
        modClient.emitEvent({
          subject: message,
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel',
            createLabelVals: [],
            negateLabelVals: ['message-test-label'],
          },
        }),
      ).rejects.toThrow('Message labels are not supported')
      const agent = network.ozone.getAgent()
      const messageLabels = await agent.api.com.atproto.label.queryLabels({
        uriPatterns: [uri],
      })
      expect(messageLabels.data.labels).toEqual([])
      const accountLabels = await agent.api.com.atproto.label.queryLabels({
        uriPatterns: [did],
      })
      expect(
        accountLabels.data.labels.some(
          (label) => label.val === 'message-test-label',
        ),
      ).toBe(false)
      await modClient.emitEvent({
        subject: account,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['message-test-label'],
          negateLabelVals: [],
        },
      })
      const updatedAccountLabels =
        await agent.api.com.atproto.label.queryLabels({
          uriPatterns: [did],
        })
      expect(updatedAccountLabels.data.labels).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ val: 'message-test-label' }),
        ]),
      )
    })

    it('actions specific report IDs and updates status to closed', async () => {
      // Create 3 reports on bob's account
      const bobsAccount = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.bob,
      }

      for (let i = 0; i < 3; i++) {
        await sc.createReport({
          reasonType: ComAtprotoModerationDefs.REASONSPAM,
          reason: `Spam report ${i}`,
          subject: bobsAccount,
          reportedBy: sc.dids.alice,
        })
      }

      await network.processAll()

      // Query to get the actual report table IDs
      const allBobReports = await modClient.queryReports({
        status: 'open',
        subject: sc.dids.bob,
      })
      const reportIds = allBobReports.reports.map((r) => r.id)

      // Action the first 2 reports with an acknowledge event
      await modClient.emitEvent({
        event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
        subject: bobsAccount,
        reportAction: {
          ids: [reportIds[0], reportIds[1]],
          note: 'Reviewed and found no violation',
        },
      })

      // Query reports and verify status — split by expected status since
      // queryReports requires a status filter
      const closedBobReports = await modClient.queryReports({
        status: 'closed',
        subject: sc.dids.bob,
      })
      const openBobReports = await modClient.queryReports({
        status: 'open',
        subject: sc.dids.bob,
      })

      // First 2 should be closed, third should still be open
      const report1 = closedBobReports.reports.find(
        (r) => r.id === reportIds[0],
      )
      const report2 = closedBobReports.reports.find(
        (r) => r.id === reportIds[1],
      )
      const report3 = openBobReports.reports.find((r) => r.id === reportIds[2])

      expect(report1?.status).toBe('closed')
      expect(report1?.actionNote).toBe('Reviewed and found no violation')
      expect(report1?.actionEventIds?.length).toBe(1)

      expect(report2?.status).toBe('closed')
      expect(report2?.actionNote).toBe('Reviewed and found no violation')
      expect(report2?.actionEventIds?.length).toBe(1)

      expect(report3?.status).toBe('open')
      expect(report3?.actionNote).toBeFalsy()
      expect(report3?.actionEventIds).toBeFalsy()
    })

    it('actions reports by type and associates multiple events', async () => {
      // Create mixed reports on alice's account
      const alicesAccount = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      }

      // Create 2 spam and 2 misleading reports
      for (let i = 0; i < 2; i++) {
        await sc.createReport({
          reasonType: ComAtprotoModerationDefs.REASONSPAM,
          reason: `Spam ${i}`,
          subject: alicesAccount,
          reportedBy: sc.dids.bob,
        })
        await sc.createReport({
          reasonType: ComAtprotoModerationDefs.REASONMISLEADING,
          reason: `Misleading ${i}`,
          subject: alicesAccount,
          reportedBy: sc.dids.bob,
        })
      }

      await network.processAll()

      // Action only spam reports with takedown
      const takedownEvent = await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTakedown',
          comment: 'Spam account',
        },
        subject: alicesAccount,
        reportAction: {
          types: ['com.atproto.moderation.defs#reasonSpam'],
          note: 'Account taken down for spam',
        },
      })

      // Later, escalate the misleading reports
      const escalateEvent = await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventEscalate',
          comment: 'Needs review',
        },
        subject: alicesAccount,
        reportAction: {
          types: ['com.atproto.moderation.defs#reasonMisleading'],
        },
      })

      // Query and verify
      const spamReports = await modClient.queryReports({
        status: 'closed',
        subject: sc.dids.alice,
        reportTypes: [ComAtprotoModerationDefs.REASONSPAM],
      })
      const misleadingReports = await modClient.queryReports({
        status: 'escalated',
        subject: sc.dids.alice,
        reportTypes: [ComAtprotoModerationDefs.REASONMISLEADING],
      })

      // Spam reports should be closed with takedown event ID
      expect(spamReports.reports.length).toBe(2)
      spamReports.reports.forEach((report) => {
        expect(report.status).toBe('closed')
        expect(report.actionNote).toBe('Account taken down for spam')
        expect(report.actionEventIds).toContain(takedownEvent.id)
      })

      // Misleading reports should be escalated with escalate event ID
      expect(misleadingReports.reports.length).toBe(2)
      misleadingReports.reports.forEach((report) => {
        expect(report.status).toBe('escalated')
        expect(report.actionEventIds).toContain(escalateEvent.id)
      })
    })

    it('actions all reports on a subject and dismisses with comment event', async () => {
      // Create a post with multiple reports (use Carol's post to avoid conflicts)
      const carolsPost = {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.carol][0].ref.uriStr,
        cid: sc.posts[sc.dids.carol][0].ref.cidStr,
      }

      // Create 3 reports of different types
      await sc.createReport({
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        reason: 'Spam post',
        subject: carolsPost,
        reportedBy: sc.dids.bob,
      })
      await sc.createReport({
        reasonType: ComAtprotoModerationDefs.REASONMISLEADING,
        reason: 'Misleading content',
        subject: carolsPost,
        reportedBy: sc.dids.bob,
      })
      await sc.createReport({
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        reason: 'Another spam report',
        subject: carolsPost,
        reportedBy: sc.dids.dan,
      })

      await network.processAll()

      // Dismiss all reports with a comment (no subject action)
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventComment',
          comment: 'False positive',
        },
        subject: carolsPost,
        reportAction: {
          all: true,
          note: 'Thank you for reporting. No violation found.',
        },
      })

      // Query reports on this post
      const postReports = await modClient.queryReports({
        status: 'closed',
        subject: carolsPost.uri,
      })

      // All 3 reports should be closed
      expect(postReports.reports.length).toBe(3)
      postReports.reports.forEach((report) => {
        expect(report.status).toBe('closed')
        expect(report.actionNote).toBe(
          'Thank you for reporting. No violation found.',
        )
        expect(report.actionEventIds?.length).toBeGreaterThan(0)
      })
    })

    it('validates report IDs belong to the subject and throws error for mismatches', async () => {
      // Create reports on two different subjects (use carol and dan to avoid conflicts)
      const carolsAccount = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.carol,
      }
      const dansAccount = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.dan,
      }

      await sc.createReport({
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        reason: 'Spam',
        subject: carolsAccount,
        reportedBy: sc.dids.bob,
      })

      await sc.createReport({
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        reason: 'Spam',
        subject: dansAccount,
        reportedBy: sc.dids.bob,
      })

      await network.processAll()

      // Query to get actual report table IDs
      const carolReports = await modClient.queryReports({
        status: 'open',
        subject: sc.dids.carol,
      })
      const danReports = await modClient.queryReports({
        status: 'open',
        subject: sc.dids.dan,
      })

      const carolReportId = carolReports.reports[0].id
      const danReportId = danReports.reports[0].id

      // Try to action dan's report while targeting carol's account - should fail
      const promise = modClient.emitEvent({
        event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
        subject: carolsAccount,
        reportAction: {
          ids: [danReportId],
          note: 'This should fail',
        },
      })

      await expect(promise).rejects.toThrow(
        /No matching reports found|do not exist or do not belong/,
      )

      // Verify carol's report was not affected
      const carolReportsAfter = await modClient.queryReports({
        status: 'open',
        subject: sc.dids.carol,
      })
      const report = carolReportsAfter.reports.find(
        (r) => r.id === carolReportId,
      )
      expect(report?.status).toBe('open')
      expect(report?.actionEventIds).toBeFalsy()
    })
  })
})
