import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { AtUri } from '@atproto/uri'
import {
  ACKNOWLEDGE,
  TAKEDOWN,
} from '@atproto/api/src/client/types/com/atproto/admin/moderationAction'
import {
  OTHER,
  SPAM,
} from '../../../src/lexicon/types/com/atproto/report/reasonType'
import { runTestServer, forSnapshot, CloseFn, adminAuth } from '../../_util'
import { SeedClient } from '../../seeds/client'
import basicSeed from '../../seeds/basic'

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
    const acknowledge = await sc.takeModerationAction({
      action: ACKNOWLEDGE,
      subject: {
        $type: 'com.atproto.repo.recordRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      },
    })
    await sc.createReport({
      reportedByDid: sc.dids.bob,
      reasonType: SPAM,
      subject: {
        $type: 'com.atproto.repo.recordRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      },
    })
    await sc.createReport({
      reportedByDid: sc.dids.carol,
      reasonType: OTHER,
      reason: 'defamation',
      subject: {
        $type: 'com.atproto.repo.recordRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      },
    })
    await sc.reverseModerationAction({ id: acknowledge.id })
    await sc.takeModerationAction({
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
})
