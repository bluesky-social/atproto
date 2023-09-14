import { FuzzyMatcher, encode } from '../../src/auto-moderator/fuzzy-matcher'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { AtpAgent } from '@atproto/api'
import { ImageInvalidator } from '../../src/image/invalidator'

describe('fuzzy matcher', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let fuzzyMatcher: FuzzyMatcher

  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'fuzzy_matcher',
      bsky: {
        imgInvalidator: new NoopInvalidator(),
        indexer: {
          fuzzyMatchB64: encode(['evil']),
        },
      },
    })
    fuzzyMatcher = new FuzzyMatcher(['evil', 'mean', 'bad'], ['baddie'])
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
    return network.bsky.ctx.db
      .getPrimary()
      .db.selectFrom('moderation_report')
      .selectAll()
      .orderBy('id', 'asc')
      .execute()
  }

  it('identifies fuzzy matches', () => {
    expect(fuzzyMatcher.getMatches('evil.john.test')).toMatchObject(['evil'])
    expect(fuzzyMatcher.getMatches('john.evil.test')).toMatchObject(['evil'])
    expect(fuzzyMatcher.getMatches('john.test.evil')).toMatchObject(['evil'])
    expect(fuzzyMatcher.getMatches('ev1l.test.john')).toMatchObject(['evil'])
    expect(fuzzyMatcher.getMatches('ev-1l.test.john')).toMatchObject(['evil'])
    expect(fuzzyMatcher.getMatches('ev-11.test.john')).toMatchObject(['evil'])
    expect(fuzzyMatcher.getMatches('ev.-1.l-test.john')).toMatchObject(['evil'])
  })

  it('identifies fuzzy false positivies', () => {
    expect(fuzzyMatcher.getMatches('john.test')).toHaveLength(0)
    expect(fuzzyMatcher.getMatches('good.john.test')).toHaveLength(0)
    expect(fuzzyMatcher.getMatches('john.baddie.test')).toHaveLength(0)
  })

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
    await network.processAll()

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

class NoopInvalidator implements ImageInvalidator {
  async invalidate() {}
}
