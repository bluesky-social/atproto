import AtpAgent from '@atproto/api'
import {
  ACKNOWLEDGE,
  TAKEDOWN,
} from '@atproto/api/src/client/types/com/atproto/admin/defs'
import {
  REASONOTHER,
  REASONSPAM,
} from '../../../src/lexicon/types/com/atproto/moderation/defs'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  adminAuth,
  TestServerInfo,
} from '../../_util'
import { SeedClient } from '../../seeds/client'
import basicSeed from '../../seeds/basic'

describe('pds admin get repo view', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'views_admin_get_repo',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await close()
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
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('fails when repo does not exist.', async () => {
    const promise = agent.api.com.atproto.admin.getRepo(
      { did: 'did:plc:doesnotexist' },
      { headers: { authorization: adminAuth() } },
    )
    await expect(promise).rejects.toThrow('Repo not found')
  })

  it('serves labels.', async () => {
    const { ctx } = server
    const labelingService = ctx.services.appView.label(ctx.db)
    await labelingService.formatAndCreate(
      ctx.cfg.labelerDid,
      sc.dids.alice,
      null,
      { create: ['kittens', 'puppies', 'birds'] },
    )
    await labelingService.formatAndCreate(
      ctx.cfg.labelerDid,
      sc.dids.alice,
      null,
      { negate: ['birds'] },
    )
    const result = await agent.api.com.atproto.admin.getRepo(
      { did: sc.dids.alice },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })
})
