import AtpAgent from '@atproto/api'
import {
  FLAG,
  TAKEDOWN,
} from '@atproto/api/src/client/types/com/atproto/admin/defs'
import {
  REASONOTHER,
  REASONSPAM,
} from '../../../src/lexicon/types/com/atproto/moderation/defs'
import { runTestServer, forSnapshot, CloseFn, adminAuth } from '../../_util'
import { SeedClient } from '../../seeds/client'
import basicSeed from '../../seeds/basic'

describe('pds admin get moderation action view', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_admin_get_moderation_report',
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

  it('gets moderation report for a repo.', async () => {
    const result = await agent.api.com.atproto.admin.getModerationReport(
      { id: 1 },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('gets moderation report for a record.', async () => {
    const result = await agent.api.com.atproto.admin.getModerationReport(
      { id: 2 },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('fails when moderation report does not exist.', async () => {
    const promise = agent.api.com.atproto.admin.getModerationReport(
      { id: 100 },
      { headers: { authorization: adminAuth() } },
    )
    await expect(promise).rejects.toThrow('Report not found')
  })
})
