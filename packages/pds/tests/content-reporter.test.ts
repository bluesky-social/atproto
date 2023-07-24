import { encode } from '../src/content-reporter'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { AtpAgent } from '@atproto/api'

describe('content reporter', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'content_reporter',
      pds: {
        unacceptableWordsB64: encode(['evil']),
      },
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  const getAllReports = () => {
    return network.pds.ctx.db.db
      .selectFrom('moderation_report')
      .selectAll()
      .orderBy('id', 'asc')
      .execute()
  }

  it('doesnt label any of the content in the seed', async () => {
    const reports = await getAllReports()
    expect(reports.length).toBe(0)
  })

  it('flags a handle with an unacceptable word', async () => {
    await sc.updateHandle(alice, 'evil.test')
    await network.processAll()
    const reports = await getAllReports()
    expect(reports.length).toBe(1)
    expect(reports.at(-1)?.subjectDid).toEqual(alice)
  })

  it('flags a profile with an unacceptable displayName', async () => {
    const res = await agent.api.com.atproto.repo.putRecord(
      {
        repo: alice,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        record: {
          displayName: 'evil alice',
        },
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await network.pds.ctx.backgroundQueue.processAll()

    const reports = await getAllReports()
    expect(reports.length).toBe(2)
    expect(reports.at(-1)?.subjectUri).toEqual(res.data.uri)
    expect(reports.at(-1)?.subjectCid).toEqual(res.data.cid)
  })

  it('flags a list with an unacceptable name', async () => {
    const res = await agent.api.com.atproto.repo.createRecord(
      {
        repo: alice,
        collection: 'app.bsky.graph.list',
        rkey: 'list',
        record: {
          name: 'myevillist',
          purpose: 'app.bsky.graph.defs#modList',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await network.processAll()

    const reports = await getAllReports()
    expect(reports.length).toBe(3)
    expect(reports.at(-1)?.subjectUri).toEqual(res.data.uri)
    expect(reports.at(-1)?.subjectCid).toEqual(res.data.cid)
  })

  it('flags a feed generator with an unacceptable displayName', async () => {
    const res = await agent.api.com.atproto.repo.createRecord(
      {
        repo: alice,
        collection: 'app.bsky.feed.generator',
        rkey: 'generator',
        record: {
          did: alice,
          displayName: 'myevilfeed',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await network.processAll()

    const reports = await getAllReports()
    expect(reports.length).toBe(4)
    expect(reports.at(-1)?.subjectUri).toEqual(res.data.uri)
    expect(reports.at(-1)?.subjectCid).toEqual(res.data.cid)
  })

  it('flags a record with an unacceptable rkey', async () => {
    const res = await agent.api.com.atproto.repo.createRecord(
      {
        repo: alice,
        collection: 'app.bsky.feed.generator',
        rkey: 'evilrkey',
        record: {
          did: alice,
          displayName: 'totally fine feed',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await network.processAll()

    const reports = await getAllReports()
    expect(reports.length).toBe(5)
    expect(reports.at(-1)?.subjectUri).toEqual(res.data.uri)
    expect(reports.at(-1)?.subjectCid).toEqual(res.data.cid)
  })
})
