import assert from 'node:assert'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { AtUri } from '@atproto/syntax'
import {
  REASONMISLEADING,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import { isMain as isStrongRef } from '../src/lexicon/types/com/atproto/repo/strongRef'

describe('query-reports', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  const seedReports = async () => {
    const bobsAccount = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }
    const alicesAccount = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.alice,
    }
    const bobsPost = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.bob][0].ref.uriStr,
      cid: sc.posts[sc.dids.bob][0].ref.cidStr,
    }
    const alicesPost = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.alice][1].ref.uriStr,
      cid: sc.posts[sc.dids.alice][1].ref.cidStr,
    }

    // Create various reports
    for (let i = 0; i < 3; i++) {
      await sc.createReport({
        reasonType: i % 2 ? REASONSPAM : REASONMISLEADING,
        reason: `Report ${i} on bob's account`,
        subject: bobsAccount,
        reportedBy: sc.dids.alice,
      })
    }

    for (let i = 0; i < 2; i++) {
      await sc.createReport({
        reasonType: REASONSPAM,
        reason: `Report ${i} on alice's account`,
        subject: alicesAccount,
        reportedBy: sc.dids.bob,
      })
    }

    await sc.createReport({
      reasonType: REASONSPAM,
      reason: "Report on bob's post",
      subject: bobsPost,
      reportedBy: sc.dids.alice,
    })

    await sc.createReport({
      reasonType: REASONMISLEADING,
      reason: "Report on alice's post",
      subject: alicesPost,
      reportedBy: sc.dids.bob,
    })
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_query_reports',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
    await seedReports()
  })

  beforeEach(async () => {
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('queryReports', () => {
    it('returns all reports when no filters are provided', async () => {
      const response = await modClient.queryReports({})

      // We created 7 reports total (3 on bob's account, 2 on alice's account, 1 on bob's post, 1 on alice's post)
      expect(response.reports.length).toBe(7)

      // All reports should have required fields
      response.reports.forEach((report) => {
        expect(report.id).toBeDefined()
        expect(report.eventId).toBeDefined()
        expect(report.status).toBe('open') // All newly created reports should be open
        expect(report.subject).toBeDefined()
        expect(report.reportType).toBeDefined()
        expect(report.reportedBy).toBeDefined()
        expect(report.createdAt).toBeDefined()
      })
    })

    it('filters reports by subjectType (account)', async () => {
      const response = await modClient.queryReports({
        subjectType: 'account',
      })

      // Should return 5 account reports (3 on bob, 2 on alice)
      expect(response.reports.length).toBe(5)

      // All subjects should be accounts (no URI)
      response.reports.forEach((report) => {
        expect(report.subject.type).toBe('account')
        assert(!isStrongRef(report.subject.subject))
      })
    })

    it('filters reports by subjectType (record)', async () => {
      const response = await modClient.queryReports({
        subjectType: 'record',
      })

      // Should return 2 record reports (1 on bob's post, 1 on alice's post)
      expect(response.reports.length).toBe(2)

      // All subjects should be records (have URI)
      response.reports.forEach((report) => {
        expect(report.subject.type).toBe('record')
        assert(isStrongRef(report.subject.subject))
      })
    })

    it('filters reports by specific subject DID', async () => {
      const response = await modClient.queryReports({
        subject: sc.dids.bob,
      })

      // Should return 3 reports on bob's account
      expect(response.reports.length).toBe(3)

      response.reports.forEach((report) => {
        expect(report.subject.subject.did).toBe(sc.dids.bob)
      })
    })

    it('filters reports by specific subject URI', async () => {
      const bobsPostUri = sc.posts[sc.dids.bob][0].ref.uriStr

      const response = await modClient.queryReports({
        subject: bobsPostUri,
      })

      // Should return 1 report on bob's post
      expect(response.reports.length).toBe(1)
      assert(isStrongRef(response.reports[0].subject.subject))
      expect(response.reports[0].subject.subject.uri).toBe(bobsPostUri)
    })

    it('filters reports by report type', async () => {
      const spamResponse = await modClient.queryReports({
        reportTypes: [REASONSPAM],
      })

      // Should return 4 spam reports
      expect(spamResponse.reports.length).toBe(4)
      spamResponse.reports.forEach((report) => {
        expect(report.reportType).toBe(REASONSPAM)
      })

      const misleadingResponse = await modClient.queryReports({
        reportTypes: [REASONMISLEADING],
      })

      // Should return 3 misleading reports
      expect(misleadingResponse.reports.length).toBe(3)
      misleadingResponse.reports.forEach((report) => {
        expect(report.reportType).toBe(REASONMISLEADING)
      })
    })

    it('filters reports by collection', async () => {
      const response = await modClient.queryReports({
        collections: ['app.bsky.feed.post'],
      })

      // Should return 2 post reports
      expect(response.reports.length).toBe(2)

      response.reports.forEach((report) => {
        assert(isStrongRef(report.subject.subject))
        const uri = new AtUri(report.subject.subject.uri)
        expect(uri.collection).toBe('app.bsky.feed.post')
      })
    })

    it('filters reports by status', async () => {
      const openResponse = await modClient.queryReports({
        status: 'open',
      })

      // All 7 reports should be open
      expect(openResponse.reports.length).toBe(7)
      openResponse.reports.forEach((report) => {
        expect(report.status).toBe('open')
      })

      const closedResponse = await modClient.queryReports({
        status: 'closed',
      })

      // No reports should be closed yet
      expect(closedResponse.reports.length).toBe(0)
    })

    it('supports pagination with limit and cursor', async () => {
      const firstPage = await modClient.queryReports({
        limit: 3,
      })

      expect(firstPage.reports.length).toBe(3)
      expect(firstPage.cursor).toBeDefined()

      const secondPage = await modClient.queryReports({
        limit: 3,
        cursor: firstPage.cursor,
      })

      expect(secondPage.reports.length).toBe(3)
      expect(secondPage.cursor).toBeDefined()

      // Reports should be different
      const firstPageIds = new Set(firstPage.reports.map((r) => r.id))
      const secondPageIds = new Set(secondPage.reports.map((r) => r.id))
      const intersection = [...firstPageIds].filter((id) =>
        secondPageIds.has(id),
      )
      expect(intersection.length).toBe(0)
    })

    it('sorts reports by createdAt descending by default', async () => {
      const response = await modClient.queryReports({})

      // Check that reports are sorted by createdAt descending
      for (let i = 0; i < response.reports.length - 1; i++) {
        const current = new Date(response.reports[i].createdAt)
        const next = new Date(response.reports[i + 1].createdAt)
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime())
      }
    })

    it('supports sorting by createdAt ascending', async () => {
      const response = await modClient.queryReports({
        sortField: 'createdAt',
        sortDirection: 'asc',
      })

      // Check that reports are sorted by createdAt ascending
      for (let i = 0; i < response.reports.length - 1; i++) {
        const current = new Date(response.reports[i].createdAt)
        const next = new Date(response.reports[i + 1].createdAt)
        expect(current.getTime()).toBeLessThanOrEqual(next.getTime())
      }
    })

    it('includes subject details in report view', async () => {
      const response = await modClient.queryReports({
        limit: 1,
      })

      const report = response.reports[0]

      // Subject should have full details
      expect(report.subject).toBeDefined()
      expect(report.subject.type).toBeDefined()
      expect(report.subject.subject).toBeDefined()

      // Should have either repo or record details
      if (report.subject.type === 'account') {
        expect(report.subject.repo).toBeDefined()
      } else {
        expect(report.subject.record).toBeDefined()
      }
    })

    it('combines multiple filters correctly', async () => {
      const response = await modClient.queryReports({
        subjectType: 'account',
        reportTypes: [REASONSPAM],
      })

      // Should return spam reports on accounts only
      response.reports.forEach((report) => {
        expect(report.subject.type).toBe('account')
        expect(report.reportType).toBe(REASONSPAM)
      })
    })
  })
})
