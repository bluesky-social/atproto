import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import {
  FLAG,
  TAKEDOWN,
} from '@atproto/api/src/client/types/com/atproto/admin/moderationAction'
import {
  OTHER,
  SPAM,
} from '../../../src/lexicon/types/com/atproto/report/reasonType'
import { InputSchema as TakeActionInput } from '@atproto/api/src/client/types/com/atproto/admin/takeModerationAction'
import { InputSchema as CreateReportInput } from '@atproto/api/src/client/types/com/atproto/report/create'
import { runTestServer, forSnapshot, CloseFn, adminAuth } from '../../_util'
import { SeedClient } from '../../seeds/client'
import basicSeed from '../../seeds/basic'

describe('pds admin get moderation action view', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_admin_get_moderation_action',
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
    const reportRepo = await createReport({
      reportedByDid: sc.dids.bob,
      reasonType: SPAM,
      subject: {
        $type: 'com.atproto.repo.repoRef',
        did: sc.dids.alice,
      },
    })
    const reportRecord = await createReport({
      reportedByDid: sc.dids.carol,
      reasonType: OTHER,
      reason: 'defamation',
      subject: {
        $type: 'com.atproto.repo.recordRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      },
    })
    const flagRepo = await takeModerationAction({
      action: FLAG,
      subject: {
        $type: 'com.atproto.repo.repoRef',
        did: sc.dids.alice,
      },
    })
    const takedownRecord = await takeModerationAction({
      action: TAKEDOWN,
      subject: {
        $type: 'com.atproto.repo.recordRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      },
    })
    await resolveReports({
      actionId: flagRepo.id,
      reportIds: [reportRepo.id, reportRecord.id],
    })
    await resolveReports({
      actionId: takedownRecord.id,
      reportIds: [reportRecord.id],
    })
    await reverseModerationAction({ id: flagRepo.id })
  })

  it('gets moderation action for a repo.', async () => {
    const result = await client.com.atproto.admin.getModerationAction(
      { id: 1 },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('gets moderation action for a record.', async () => {
    const result = await client.com.atproto.admin.getModerationAction(
      { id: 2 },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('fails when moderation action does not exist.', async () => {
    const promise = client.com.atproto.admin.getModerationAction(
      { id: 100 },
      { headers: { authorization: adminAuth() } },
    )
    await expect(promise).rejects.toThrow('Action not found')
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
