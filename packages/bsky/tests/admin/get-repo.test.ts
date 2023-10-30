import { SeedClient, TestNetwork } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
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

describe('admin get repo view', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'views_admin_get_repo',
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
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await sc.createReport({
      reportedBy: sc.dids.bob,
      reasonType: REASONSPAM,
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await sc.createReport({
      reportedBy: sc.dids.carol,
      reasonType: REASONOTHER,
      reason: 'defamation',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await sc.reverseModerationAction({ id: acknowledge.id })
    await sc.takeModerationAction({
      action: TAKEDOWN,
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
  })

  it('gets a repo by did, even when taken down.', async () => {
    const result = await agent.api.com.atproto.admin.getRepo(
      { did: sc.dids.alice },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('does not include account emails for triage mods.', async () => {
    const { data: admin } = await agent.api.com.atproto.admin.getRepo(
      { did: sc.dids.bob },
      { headers: network.pds.adminAuthHeaders() },
    )
    const { data: moderator } = await agent.api.com.atproto.admin.getRepo(
      { did: sc.dids.bob },
      { headers: network.pds.adminAuthHeaders('moderator') },
    )
    const { data: triage } = await agent.api.com.atproto.admin.getRepo(
      { did: sc.dids.bob },
      { headers: network.pds.adminAuthHeaders('triage') },
    )
    expect(admin.email).toEqual('bob@test.com')
    expect(moderator.email).toEqual('bob@test.com')
    expect(triage.email).toBeUndefined()
    expect(triage).toEqual({ ...admin, email: undefined })
  })

  it('fails when repo does not exist.', async () => {
    const promise = agent.api.com.atproto.admin.getRepo(
      { did: 'did:plc:doesnotexist' },
      { headers: network.pds.adminAuthHeaders() },
    )
    await expect(promise).rejects.toThrow('Repo not found')
  })
})
