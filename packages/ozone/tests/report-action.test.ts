import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import {
  REASONMISLEADING,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'

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
    await network.close()
  })

  describe('emitEvent with reportAction', () => {
    it('actions specific report IDs and updates status to closed', async () => {
      // Create 3 reports on bob's account
      const bobsAccount = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.bob,
      }

      for (let i = 0; i < 3; i++) {
        await sc.createReport({
          reasonType: REASONSPAM,
          reason: `Spam report ${i}`,
          subject: bobsAccount,
          reportedBy: sc.dids.alice,
        })
      }

      await network.processAll()

      // Query to get the actual report table IDs
      const allBobReports = await modClient.queryReports({
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

      // Query reports and verify status
      const allReports = await modClient.queryReports({
        subject: sc.dids.bob,
      })

      // First 2 should be closed, third should still be open
      const report1 = allReports.reports.find((r) => r.id === reportIds[0])
      const report2 = allReports.reports.find((r) => r.id === reportIds[1])
      const report3 = allReports.reports.find((r) => r.id === reportIds[2])

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
          reasonType: REASONSPAM,
          reason: `Spam ${i}`,
          subject: alicesAccount,
          reportedBy: sc.dids.bob,
        })
        await sc.createReport({
          reasonType: REASONMISLEADING,
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
        subject: sc.dids.alice,
        reportTypes: [REASONSPAM],
      })
      const misleadingReports = await modClient.queryReports({
        subject: sc.dids.alice,
        reportTypes: [REASONMISLEADING],
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
        reasonType: REASONSPAM,
        reason: 'Spam post',
        subject: carolsPost,
        reportedBy: sc.dids.bob,
      })
      await sc.createReport({
        reasonType: REASONMISLEADING,
        reason: 'Misleading content',
        subject: carolsPost,
        reportedBy: sc.dids.bob,
      })
      await sc.createReport({
        reasonType: REASONSPAM,
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
        reasonType: REASONSPAM,
        reason: 'Spam',
        subject: carolsAccount,
        reportedBy: sc.dids.bob,
      })

      await sc.createReport({
        reasonType: REASONSPAM,
        reason: 'Spam',
        subject: dansAccount,
        reportedBy: sc.dids.bob,
      })

      await network.processAll()

      // Query to get actual report table IDs
      const carolReports = await modClient.queryReports({
        subject: sc.dids.carol,
      })
      const danReports = await modClient.queryReports({
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
