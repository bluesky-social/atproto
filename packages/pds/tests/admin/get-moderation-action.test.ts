import { TestNetworkNoAppView, SeedClient } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import {
  FLAG,
  TAKEDOWN,
} from '@atproto/api/src/client/types/com/atproto/admin/defs'
import {
  REASONOTHER,
  REASONSPAM,
} from '../../src/lexicon/types/com/atproto/moderation/defs'
import { forSnapshot } from '../_util'
import basicSeed from '../seeds/basic'

describe('pds admin get moderation action view', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'views_admin_get_moderation_action',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  beforeAll(async () => {
    const reportRepo = await sc.createReport({
      reportedBy: sc.dids.bob,
      reasonType: REASONSPAM,
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    const reportRecord = await sc.createReport({
      reportedBy: sc.dids.carol,
      reasonType: REASONOTHER,
      reason: 'defamation',
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })
    const flagRepo = await sc.takeModerationAction({
      action: FLAG,
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    const takedownRecord = await sc.takeModerationAction({
      action: TAKEDOWN,
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })
    await sc.resolveReports({
      actionId: flagRepo.id,
      reportIds: [reportRepo.id, reportRecord.id],
    })
    await sc.resolveReports({
      actionId: takedownRecord.id,
      reportIds: [reportRecord.id],
    })
    await sc.reverseModerationAction({ id: flagRepo.id })
  })

  it('gets moderation action for a repo.', async () => {
    // id 2 because id 1 is in seed client
    const result = await agent.api.com.atproto.admin.getModerationAction(
      { id: 2 },
      { headers: { authorization: network.pds.adminAuth() } },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('gets moderation action for a record.', async () => {
    // id 3 because id 1 is in seed client
    const result = await agent.api.com.atproto.admin.getModerationAction(
      { id: 3 },
      { headers: { authorization: network.pds.adminAuth() } },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('fails when moderation action does not exist.', async () => {
    const promise = agent.api.com.atproto.admin.getModerationAction(
      { id: 100 },
      { headers: { authorization: network.pds.adminAuth() } },
    )
    await expect(promise).rejects.toThrow('Action not found')
  })
})
