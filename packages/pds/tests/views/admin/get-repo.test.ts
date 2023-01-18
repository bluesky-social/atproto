import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import {
  ACKNOWLEDGE,
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

describe('pds admin get repo view', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_admin_get_repo',
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
    const acknowledge = await takeModerationAction({
      action: ACKNOWLEDGE,
      subject: {
        $type: 'com.atproto.repo.repoRef',
        did: sc.dids.alice,
      },
    })
    await createReport({
      reportedByDid: sc.dids.bob,
      reasonType: SPAM,
      subject: {
        $type: 'com.atproto.repo.repoRef',
        did: sc.dids.alice,
      },
    })
    await createReport({
      reportedByDid: sc.dids.carol,
      reasonType: OTHER,
      reason: 'defamation',
      subject: {
        $type: 'com.atproto.repo.repoRef',
        did: sc.dids.alice,
      },
    })
    await reverseModerationAction({ id: acknowledge.id })
    await takeModerationAction({
      action: TAKEDOWN,
      subject: {
        $type: 'com.atproto.repo.repoRef',
        did: sc.dids.alice,
      },
    })
  })

  it('gets a repo by did, even when taken down.', async () => {
    const result = await client.com.atproto.admin.getRepo(
      { did: sc.dids.alice },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('fails when repo does not exist.', async () => {
    const promise = client.com.atproto.admin.getRepo(
      { did: 'did:plc:doesnotexist' },
      { headers: { authorization: adminAuth() } },
    )
    await expect(promise).rejects.toThrow('Repo not found')
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
