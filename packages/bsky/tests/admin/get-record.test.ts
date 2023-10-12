import { SeedClient, TestNetwork } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import {
  ACKNOWLEDGE,
  TAKEDOWN,
} from '@atproto/api/src/client/types/com/atproto/admin/defs'
import {
  REASONOTHER,
  REASONSPAM,
} from '../../src/lexicon/types/com/atproto/moderation/defs'
import { forSnapshot } from '../_util'
import basicSeed from '../seeds/basic'

describe('admin get record view', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'views_admin_get_record',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  beforeAll(async () => {
    const acknowledge = await sc.takeModerationAction({
      action: ACKNOWLEDGE,
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })
    await sc.createReport({
      reportedBy: sc.dids.bob,
      reasonType: REASONSPAM,
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })
    await sc.createReport({
      reportedBy: sc.dids.carol,
      reasonType: REASONOTHER,
      reason: 'defamation',
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })
    await sc.reverseModerationAction({ id: acknowledge.id })
    await sc.takeModerationAction({
      action: TAKEDOWN,
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })
  })

  it('gets a record by uri, even when taken down.', async () => {
    const result = await agent.api.com.atproto.admin.getRecord(
      { uri: sc.posts[sc.dids.alice][0].ref.uriStr },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('gets a record by uri and cid.', async () => {
    const result = await agent.api.com.atproto.admin.getRecord(
      {
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('fails when record does not exist.', async () => {
    const promise = agent.api.com.atproto.admin.getRecord(
      {
        uri: AtUri.make(
          sc.dids.alice,
          'app.bsky.feed.post',
          'badrkey',
        ).toString(),
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    await expect(promise).rejects.toThrow('Record not found')
  })

  it('fails when record cid does not exist.', async () => {
    const promise = agent.api.com.atproto.admin.getRecord(
      {
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][1].ref.cidStr, // Mismatching cid
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    await expect(promise).rejects.toThrow('Record not found')
  })
})
