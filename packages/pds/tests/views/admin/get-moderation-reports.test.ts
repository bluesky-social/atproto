import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import {
  ACKNOWLEDGE,
  FLAG,
  TAKEDOWN,
} from '@atproto/api/src/client/types/com/atproto/admin/moderationAction'
import {
  OTHER,
  SPAM,
} from '../../../src/lexicon/types/com/atproto/report/reasonType'
import { InputSchema as TakeActionInput } from '@atproto/api/src/client/types/com/atproto/admin/takeModerationAction'
import { InputSchema as CreateReportInput } from '@atproto/api/src/client/types/com/atproto/report/create'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  adminAuth,
  paginateAll,
} from '../../_util'
import { SeedClient } from '../../seeds/client'
import basicSeed from '../../seeds/basic'

describe('pds admin get moderation reports view', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_admin_get_moderation_reports',
    })
    close = server.close
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await close()
  })

  beforeAll(async () => {
    const oneIn = (n) => (_, i) => i % n === 0
    const getAction = (i) => [FLAG, ACKNOWLEDGE, TAKEDOWN][i % 3]
    const getReasonType = (i) => [OTHER, SPAM][i % 2]
    const getReportedByDid = (i) => [sc.dids.alice, sc.dids.carol][i % 2]
    const posts = Object.values(sc.posts)
      .flatMap((x) => x)
      .filter(oneIn(2))
    const dids = Object.values(sc.dids).filter(oneIn(2))
    const recordReports: Awaited<ReturnType<typeof createReport>>[] = []
    for (let i = 0; i < posts.length; ++i) {
      const post = posts[i]
      recordReports.push(
        await createReport({
          reasonType: getReasonType(i),
          reportedByDid: getReportedByDid(i),
          subject: {
            $type: 'com.atproto.repo.recordRef',
            uri: post.ref.uriStr,
          },
        }),
      )
    }
    const repoReports: Awaited<ReturnType<typeof createReport>>[] = []
    for (let i = 0; i < posts.length; ++i) {
      const did = dids[i]
      repoReports.push(
        await createReport({
          reasonType: getReasonType(i),
          reportedByDid: getReportedByDid(i),
          subject: {
            $type: 'com.atproto.repo.repoRef',
            did,
          },
        }),
      )
    }
    for (let i = 0; i < recordReports.length; ++i) {
      const report = recordReports[i]
      const ab = oneIn(2)(report, i)
      const action = await takeModerationAction({
        action: getAction(i),
        subject: {
          $type: 'com.atproto.repo.recordRef',
          uri: report.subject.uri,
        },
      })
      if (ab) {
        await resolveReports({
          actionId: action.id,
          reportIds: [report.id],
        })
      } else {
        await reverseModerationAction({
          id: action.id,
        })
      }
    }
    for (let i = 0; i < repoReports.length; ++i) {
      const report = repoReports[i]
      const ab = oneIn(2)(report, i)
      const action = await takeModerationAction({
        action: getAction(i),
        subject: {
          $type: 'com.atproto.repo.repoRef',
          did: report.subject.did,
        },
      })
      if (ab) {
        await resolveReports({
          actionId: action.id,
          reportIds: [report.id],
        })
      } else {
        await reverseModerationAction({
          id: action.id,
        })
      }
    }
  })

  it('gets all moderation reports.', async () => {
    const result = await client.com.atproto.admin.getModerationReports(
      {},
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data.reports)).toMatchSnapshot()
  })

  it('gets all moderation reports for a repo.', async () => {
    const result = await client.com.atproto.admin.getModerationReports(
      { subject: Object.values(sc.dids)[0] },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data.reports)).toMatchSnapshot()
  })

  it('gets all moderation reports for a record.', async () => {
    const result = await client.com.atproto.admin.getModerationReports(
      { subject: Object.values(sc.posts)[0][0].ref.uriStr },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data.reports)).toMatchSnapshot()
  })

  it('gets all resolved/unresolved moderation reports.', async () => {
    const resolved = await client.com.atproto.admin.getModerationReports(
      { resolved: true },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(resolved.data.reports)).toMatchSnapshot()
    const unresolved = await client.com.atproto.admin.getModerationReports(
      { resolved: false },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(unresolved.data.reports)).toMatchSnapshot()
  })

  it('paginates.', async () => {
    const results = (results) => results.flatMap((res) => res.reports)
    const paginator = async (cursor?: string) => {
      const res = await client.com.atproto.admin.getModerationReports(
        { before: cursor, limit: 3 },
        { headers: { authorization: adminAuth() } },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.reports.length).toBeLessThanOrEqual(3),
    )

    const full = await client.com.atproto.admin.getModerationReports(
      {},
      { headers: { authorization: adminAuth() } },
    )

    expect(full.data.reports.length).toEqual(8)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  async function takeModerationAction(opts: {
    action: TakeActionInput['action']
    subject: TakeActionInput['subject']
    reason?: string
    createdBy?: string
  }) {
    const { action, subject, reason = 'X', createdBy = 'Y' } = opts
    const result = await client.com.atproto.admin.takeModerationAction(
      { action, subject, createdBy, reason },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    return result.data
  }

  async function reverseModerationAction(opts: {
    id: number
    reason?: string
    createdBy?: string
  }) {
    const { id, reason = 'X', createdBy = 'Y' } = opts
    const result = await client.com.atproto.admin.reverseModerationAction(
      { id, reason, createdBy },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    return result.data
  }

  async function resolveReports(opts: {
    actionId: number
    reportIds: number[]
    createdBy?: string
  }) {
    const { actionId, reportIds, createdBy = 'Y' } = opts
    const result = await client.com.atproto.admin.resolveModerationReports(
      { actionId, createdBy, reportIds },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    return result.data
  }

  async function createReport(opts: {
    reasonType: CreateReportInput['reasonType']
    subject: CreateReportInput['subject']
    reason?: string
    reportedByDid: string
  }) {
    const { reasonType, subject, reason, reportedByDid } = opts
    const result = await client.com.atproto.report.create(
      { reasonType, subject, reason },
      {
        encoding: 'application/json',
        headers: sc.getHeaders(reportedByDid),
      },
    )
    return result.data
  }
})
