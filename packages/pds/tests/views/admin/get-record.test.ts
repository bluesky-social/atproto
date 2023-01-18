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
import { AtUri } from '@atproto/uri'

describe('pds admin get record view', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_admin_get_record',
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
        $type: 'com.atproto.repo.recordRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      },
    })
    await createReport({
      reportedByDid: sc.dids.bob,
      reasonType: SPAM,
      subject: {
        $type: 'com.atproto.repo.recordRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      },
    })
    await createReport({
      reportedByDid: sc.dids.carol,
      reasonType: OTHER,
      reason: 'defamation',
      subject: {
        $type: 'com.atproto.repo.recordRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      },
    })
    await reverseModerationAction({ id: acknowledge.id })
    await takeModerationAction({
      action: TAKEDOWN,
      subject: {
        $type: 'com.atproto.repo.recordRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      },
    })
  })

  it('gets a record by uri, even when taken down.', async () => {
    const result = await client.com.atproto.admin.getRecord(
      { uri: sc.posts[sc.dids.alice][0].ref.uriStr },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('gets a record by uri and cid.', async () => {
    const result = await client.com.atproto.admin.getRecord(
      {
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('fails when record does not exist.', async () => {
    const promise = client.com.atproto.admin.getRecord(
      {
        uri: AtUri.make(
          sc.dids.alice,
          'app.bsky.feed.post',
          'badrkey',
        ).toString(),
      },
      { headers: { authorization: adminAuth() } },
    )
    await expect(promise).rejects.toThrow('Record not found')
  })

  it('fails when record cid does not exist.', async () => {
    const promise = client.com.atproto.admin.getRecord(
      {
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][1].ref.cidStr, // Mismatching cid
      },
      { headers: { authorization: adminAuth() } },
    )
    await expect(promise).rejects.toThrow('Record not found')
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
