import AtpAgent from '@atproto/api'
import {
  ACKNOWLEDGE,
  FLAG,
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
  paginateAll,
} from '../../_util'
import { SeedClient } from '../../seeds/client'
import basicSeed from '../../seeds/basic'

describe('pds admin get moderation actions view', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_admin_get_moderation_actions',
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
    const oneIn = (n) => (_, i) => i % n === 0
    const getAction = (i) => [FLAG, ACKNOWLEDGE, TAKEDOWN][i % 3]
    const posts = Object.values(sc.posts)
      .flatMap((x) => x)
      .filter(oneIn(2))
    const dids = Object.values(sc.dids).filter(oneIn(2))
    // Take actions on records
    const recordActions: Awaited<ReturnType<typeof sc.takeModerationAction>>[] =
      []
    for (let i = 0; i < posts.length; ++i) {
      const post = posts[i]
      recordActions.push(
        await sc.takeModerationAction({
          action: getAction(i),
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: post.ref.uriStr,
            cid: post.ref.cidStr,
          },
        }),
      )
    }
    // Reverse an action
    await sc.reverseModerationAction({
      id: recordActions[0].id,
    })
    // Take actions on repos
    const repoActions: Awaited<ReturnType<typeof sc.takeModerationAction>>[] =
      []
    for (let i = 0; i < dids.length; ++i) {
      const did = dids[i]
      repoActions.push(
        await sc.takeModerationAction({
          action: getAction(i),
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did,
          },
        }),
      )
    }
    // Back some of the actions with a report, possibly resolved
    const someRecordActions = recordActions.filter(oneIn(2))
    for (let i = 0; i < someRecordActions.length; ++i) {
      const action = someRecordActions[i]
      const ab = oneIn(2)(action, i)
      const report = await sc.createReport({
        reportedBy: ab ? sc.dids.carol : sc.dids.alice,
        reasonType: ab ? REASONSPAM : REASONOTHER,
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: action.subject.uri,
          cid: action.subject.cid,
        },
      })
      if (ab) {
        await sc.resolveReports({
          actionId: action.id,
          reportIds: [report.id],
        })
      }
    }
    const someRepoActions = repoActions.filter(oneIn(2))
    for (let i = 0; i < someRepoActions.length; ++i) {
      const action = someRepoActions[i]
      const ab = oneIn(2)(action, i)
      const report = await sc.createReport({
        reportedBy: ab ? sc.dids.carol : sc.dids.alice,
        reasonType: ab ? REASONSPAM : REASONOTHER,
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: action.subject.did,
        },
      })
      if (ab) {
        await sc.resolveReports({
          actionId: action.id,
          reportIds: [report.id],
        })
      }
    }
  })

  it('gets all moderation actions.', async () => {
    const result = await agent.api.com.atproto.admin.getModerationActions(
      {},
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data.actions)).toMatchSnapshot()
  })

  it('gets all moderation actions for a repo.', async () => {
    const result = await agent.api.com.atproto.admin.getModerationActions(
      { subject: Object.values(sc.dids)[0] },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data.actions)).toMatchSnapshot()
  })

  it('gets all moderation actions for a record.', async () => {
    const result = await agent.api.com.atproto.admin.getModerationActions(
      { subject: Object.values(sc.posts)[0][0].ref.uriStr },
      { headers: { authorization: adminAuth() } },
    )
    expect(forSnapshot(result.data.actions)).toMatchSnapshot()
  })

  it('paginates.', async () => {
    const results = (results) => results.flatMap((res) => res.actions)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.com.atproto.admin.getModerationActions(
        { cursor, limit: 3 },
        { headers: { authorization: adminAuth() } },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.actions.length).toBeLessThanOrEqual(3),
    )

    const full = await agent.api.com.atproto.admin.getModerationActions(
      {},
      { headers: { authorization: adminAuth() } },
    )

    expect(full.data.actions.length).toEqual(7) // extra one because of seed client
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
