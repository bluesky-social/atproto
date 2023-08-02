import AtpAgent from '@atproto/api'
import {
  adminAuth,
  CloseFn,
  moderatorAuth,
  runTestServer,
  TestServerInfo,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('unspecced.applyLabels', () => {
  let server: TestServerInfo
  let close: CloseFn
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'moderation',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await close()
  })

  it('requires admin auth.', async () => {
    const tryToLabel = agent.api.app.bsky.unspecced.applyLabels(
      {
        labels: [
          {
            src: server.ctx.cfg.labelerDid,
            uri: sc.dids.carol,
            val: 'cats',
            neg: false,
            cts: new Date().toISOString(),
          },
        ],
      },
      {
        encoding: 'application/json',
        headers: { authorization: moderatorAuth() },
      },
    )
    await expect(tryToLabel).rejects.toThrow('Insufficient privileges')
  })

  it('adds and removes labels on record as though applied by the labeler.', async () => {
    const post = sc.posts[sc.dids.bob][1].ref
    await agent.api.app.bsky.unspecced.applyLabels(
      {
        labels: [
          {
            src: server.ctx.cfg.labelerDid,
            uri: post.uriStr,
            cid: post.cidStr,
            val: 'birds',
            neg: false,
            cts: new Date().toISOString(),
          },
          {
            src: server.ctx.cfg.labelerDid,
            uri: post.uriStr,
            cid: post.cidStr,
            val: 'bats',
            neg: false,
            cts: new Date().toISOString(),
          },
        ],
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    await expect(getRecordLabels(post.uriStr)).resolves.toEqual([
      'birds',
      'bats',
    ])
    await agent.api.app.bsky.unspecced.applyLabels(
      {
        labels: [
          {
            src: server.ctx.cfg.labelerDid,
            uri: post.uriStr,
            cid: post.cidStr,
            val: 'birds',
            neg: true,
            cts: new Date().toISOString(),
          },
          {
            src: server.ctx.cfg.labelerDid,
            uri: post.uriStr,
            cid: post.cidStr,
            val: 'bats',
            neg: true,
            cts: new Date().toISOString(),
          },
        ],
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    await expect(getRecordLabels(post.uriStr)).resolves.toEqual([])
  })

  it('adds and removes labels on repo as though applied by the labeler.', async () => {
    await agent.api.app.bsky.unspecced.applyLabels(
      {
        labels: [
          {
            src: server.ctx.cfg.labelerDid,
            uri: sc.dids.carol,
            val: 'birds',
            neg: false,
            cts: new Date().toISOString(),
          },
          {
            src: server.ctx.cfg.labelerDid,
            uri: sc.dids.carol,
            val: 'bats',
            neg: false,
            cts: new Date().toISOString(),
          },
        ],
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    await expect(getRepoLabels(sc.dids.carol)).resolves.toEqual([
      'birds',
      'bats',
    ])
    await agent.api.app.bsky.unspecced.applyLabels(
      {
        labels: [
          {
            src: server.ctx.cfg.labelerDid,
            uri: sc.dids.carol,
            val: 'birds',
            neg: true,
            cts: new Date().toISOString(),
          },
          {
            src: server.ctx.cfg.labelerDid,
            uri: sc.dids.carol,
            val: 'bats',
            neg: true,
            cts: new Date().toISOString(),
          },
        ],
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    await expect(getRepoLabels(sc.dids.carol)).resolves.toEqual([])
  })

  async function getRecordLabels(uri: string) {
    const result = await agent.api.com.atproto.admin.getRecord(
      { uri },
      { headers: { authorization: adminAuth() } },
    )
    const labels = result.data.labels ?? []
    return labels.map((l) => l.val)
  }

  async function getRepoLabels(did: string) {
    const result = await agent.api.com.atproto.admin.getRepo(
      { did },
      { headers: { authorization: adminAuth() } },
    )
    const labels = result.data.labels ?? []
    return labels.map((l) => l.val)
  }
})
