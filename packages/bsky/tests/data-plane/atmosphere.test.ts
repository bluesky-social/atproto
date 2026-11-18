import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AtpAgent } from '@atproto/api'
import {
  type AtmosphereFixture,
  type AtmosphereSeed,
  TestNetwork,
  seedAtmosphere,
} from '@atproto/dev-env'
import { lexParseJsonBytes } from '@atproto/lex-json'
import { app, site, social } from '../../src/lexicons/index.js'
import { RecordLookupStatus } from '../../src/proto/bsky_pb.js'

const endpoint = app.bsky.unspecced.getAtmosphereRecordView

describe('local Atmosphere records and moderation', () => {
  let network: TestNetwork
  let author: AtpAgent
  let reader: AtpAgent
  let fixtures: AtmosphereSeed

  beforeAll(async () => {
    network = await TestNetwork.create({ dbPostgresSchema: 'atmosphere_local' })
    const agents: AtpAgent[] = []
    for (const handle of ['alice', 'bob', 'carla', 'dan']) {
      const agent = network.pds.getAgent()
      await agent.createAccount({
        handle: `${handle}.test`,
        email: `${handle}@example.test`,
        password: 'hunter2',
      })
      agents.push(agent)
    }
    ;[author, , , reader] = agents
    fixtures = await seedAtmosphere(network, {
      author,
      photographer: agents[1],
      streamer: agents[2],
      reporter: reader,
    })
  }, 60000)

  afterAll(async () => network?.close())

  function fixture(title: string): AtmosphereFixture {
    const found = fixtures.records.find((record) => record.title === title)
    if (!found) throw new Error(`Missing fixture: ${title}`)
    return found
  }

  async function view(record: AtmosphereFixture, exact = false) {
    return network.ozone.getClient().call(
      endpoint,
      {
        uri: record.uri as app.bsky.unspecced.getAtmosphereRecordView.$Params['uri'],
        ...(exact ? { cid: record.cid } : {}),
      },
      { headers: await network.ozone.modHeaders(endpoint.$lxm) },
    )
  }

  it('routes every fixture report into its collection queue', async () => {
    const { reports } = await network.ozone.getModClient().queryReports({
      status: 'queued',
      limit: 100,
    })
    expect(fixtures.records).toHaveLength(16)
    for (const record of fixtures.records) {
      const report = reports.find((report) => report.eventId === record.eventId)
      expect(report).toMatchObject({
        id: record.reportId,
        queue: { id: fixtures.queues[record.collection] },
        subject: { subject: record.uri },
      })
      expect(record.reportId).toBeTypeOf('number')
    }
  })

  it('hydrates real records and dependencies through the Ozone proxy', async () => {
    const article = await view(fixture('Complete article'), true)
    expect(app.bsky.embed.external.viewArticle.$matches(article.view)).toBe(
      true,
    )
    expect(article.associatedRecords).toHaveLength(2)
    expect(article.associatedRefs?.[0]).toMatchObject({
      uri: fixture('Complete article').uri,
      cid: fixture('Complete article').cid,
    })
    const gallery = await view(fixture('Gallery with three photos'))
    expect(app.bsky.embed.external.viewGallery.$matches(gallery.view)).toBe(
      true,
    )
    if (app.bsky.embed.external.viewGallery.$matches(gallery.view)) {
      expect(gallery.view.items).toHaveLength(3)
      for (const image of gallery.view.items) {
        if (!app.bsky.embed.external.viewGalleryImage.$matches(image))
          throw new Error('Expected gallery image')
        const response = await fetch(
          new URL(new URL(image.fullsize).pathname, network.bsky.url),
        )
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toMatch(/^image\//)
      }
    }
    expect(gallery.associatedRecords).toHaveLength(7)
    expect(
      app.bsky.embed.external.viewArticlePublication.$matches(
        (await view(fixture('Publication with icon and description'))).view,
      ),
    ).toBe(true)
    expect(
      app.bsky.embed.external.viewLivestream.$matches(
        (await view(fixture('Livestream with announcement'))).view,
      ),
    ).toBe(true)
    expect(
      (await view(fixture('Unavailable-publication article'))).view,
    ).toBeUndefined()
    expect(
      (await view(fixture('Generic record fallback'))).associatedRecords,
    ).toHaveLength(1)
  })

  it('requires a moderator or admin to use the Ozone proxy', async () => {
    const params = {
      uri: fixture('Complete article')
        .uri as app.bsky.unspecced.getAtmosphereRecordView.$Params['uri'],
    }
    await expect(
      network.ozone.getClient().call(endpoint, params),
    ).rejects.toThrow()
    await expect(
      network.ozone.getClient().call(endpoint, params, {
        headers: await network.serviceHeaders(
          reader.assertDid,
          endpoint.$lxm,
          network.ozone.ctx.cfg.service.did,
        ),
      }),
    ).rejects.toThrow('not a moderator account')
    const result = await network.ozone.getClient().call(endpoint, params, {
      headers: await network.adminHeaders({}),
    })
    expect(result.view).toBeDefined()
  })

  it('returns positional lookup results and never substitutes another CID', async () => {
    const record = fixture('Complete article')
    const other = fixture('Standalone HTTPS article')
    const dataplane = network.bsky.ctx.dataplane
    const { results } = await dataplane.getRecordsByRef({
      refs: [
        record,
        { uri: record.uri, cid: other.cid },
        { uri: 'not-an-at-uri', cid: record.cid },
        record,
      ],
    })
    expect(results.map((result) => result.status)).toEqual([
      RecordLookupStatus.FOUND,
      RecordLookupStatus.NOT_FOUND,
      RecordLookupStatus.INVALID_REF,
      RecordLookupStatus.FOUND,
    ])
    expect(lexParseJsonBytes(results[0].record!.record)).toMatchObject({
      title: 'Complete article with publication and linked post',
    })
    await expect(
      dataplane.getRecordsByURI({ uris: Array(101).fill(record.uri) }),
    ).rejects.toThrow('At most 100')
  })

  it('looks up backlink counts, pages, and subscriptions by actor', async () => {
    const gallery = fixture('Gallery with three photos')
    const publication = fixture('Publication with icon and description')
    const dataplane = network.bsky.ctx.dataplane
    const { results } = await dataplane.getAtmosphereBacklinkCounts({
      targetUris: [gallery.uri, publication.uri],
    })
    expect(results[0].counts[social.grain.gallery.item.$type]).toBe(3n)
    expect(results[0].counts[social.grain.favorite.$type]).toBe(1n)
    expect(results[1].counts[site.standard.graph.subscription.$type]).toBe(1n)
    const request = {
      targetUri: gallery.uri,
      collection: social.grain.gallery.item.$type,
      limit: 2,
    }
    const first = await dataplane.getAtmosphereBacklinks(request)
    expect(first.backlinks).toHaveLength(2)
    expect(first.cursor).toBeTruthy()
    const second = await dataplane.getAtmosphereBacklinks({
      ...request,
      cursor: first.cursor,
    })
    expect(second.backlinks).toHaveLength(1)
    expect(second.cursor).toBe('')
    expect(
      new Set([...first.backlinks, ...second.backlinks].map((link) => link.uri))
        .size,
    ).toBe(3)
    const byActor = await dataplane.getAtmosphereBacklinksByActor({
      actorDid: reader.assertDid,
      collection: site.standard.graph.subscription.$type,
      targetUris: [publication.uri, gallery.uri],
    })
    expect(byActor.results.map((result) => result.uris.length)).toEqual([1, 0])
    expect(byActor.truncated).toBe(false)
  })

  it('updates and deletes generic records and removes obsolete backlinks', async () => {
    const publication = fixture('Publication with icon and description')
    const { data: created } = await author.com.atproto.repo.createRecord({
      repo: author.assertDid,
      collection: site.standard.graph.subscription.$type,
      record: site.standard.graph.subscription.$build({
        publication:
          publication.uri as site.standard.graph.subscription.Main['publication'],
      }),
    })
    await network.processAll()
    const dataplane = network.bsky.ctx.dataplane
    const rkey = created.uri.split('/').at(-1)!
    const { data: updated } = await author.com.atproto.repo.putRecord({
      repo: author.assertDid,
      collection: site.standard.graph.subscription.$type,
      rkey,
      record: site.standard.graph.subscription.$build({
        publication: fixture('Minimal publication')
          .uri as site.standard.graph.subscription.Main['publication'],
      }),
    })
    await network.processAll()
    const old = await dataplane.getRecordsByRef({ refs: [created] })
    expect(old.results[0].status).toBe(RecordLookupStatus.NOT_FOUND)
    const latest = await dataplane.getRecordsByURI({ uris: [created.uri] })
    expect(latest.results[0].record?.cid).toBe(updated.cid)
    const links = await dataplane.getAtmosphereBacklinksByActor({
      actorDid: author.assertDid,
      collection: site.standard.graph.subscription.$type,
      targetUris: [publication.uri],
    })
    expect(links.results[0].uris).toEqual([])
    await dataplane.takedownRecord({ recordUri: created.uri })
    expect(
      (await dataplane.getRecordsByURI({ uris: [created.uri] })).results[0]
        .status,
    ).toBe(RecordLookupStatus.TAKEN_DOWN)
    await author.com.atproto.repo.deleteRecord({
      repo: author.assertDid,
      collection: site.standard.graph.subscription.$type,
      rkey,
    })
    await network.processAll()
    expect(
      (await dataplane.getRecordsByURI({ uris: [created.uri] })).results[0]
        .status,
    ).toBe(RecordLookupStatus.NOT_FOUND)
  })
})
