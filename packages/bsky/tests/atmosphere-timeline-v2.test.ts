import { once } from 'node:events'
import { createServer as createHttpServer } from 'node:http'
import { Timestamp } from '@bufbuild/protobuf'
import { createPromiseClient, createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it, vi } from 'vitest'
import {
  type AtUriString,
  type DidString,
  type TypedLexMap,
  atUri,
  lexStringify,
  toDatetimeString,
} from '@atproto/lex'
import { AuthRequiredError, createServer } from '@atproto/xrpc-server'
import register from '../src/api/app/bsky/unspecced/getAtmosphereTimelineV2.js'
import type { AppContext } from '../src/context.js'
import { Gate } from '../src/feature-gates/gates.js'
import { FeatureGatesClient } from '../src/feature-gates/index.js'
import { Hydrator } from '../src/hydration/hydrator.js'
import { ImageUriBuilder } from '../src/image/uri.js'
import { app, place, site } from '../src/lexicons/index.js'
import { Service } from '../src/proto/bsky_connect.js'
import { RecordLookupStatus } from '../src/proto/bsky_pb.js'
import { Views } from '../src/views/index.js'
import { VideoUriBuilder } from '../src/views/util.js'

const endpoint = app.bsky.unspecced.getAtmosphereTimelineV2
const viewer = 'did:plc:viewer'
const cid = 'bafyreie5sviu7eeu3vf6n3lrlmqef2vdlwmgzd6zpolov56agdxtshdpda'
const now = Date.parse('2026-10-29T12:00:00.000Z')
const minute = 60_000

type Row = { uri: AtUriString; time: number }

async function setup(rows: Row[], records: Map<AtUriString, TypedLexMap>) {
  const muted = new Set<string>()
  const subscriptions = new Map<AtUriString, AtUriString>()
  let enabled = true
  const timelineCalls: string[] = []
  const dataplane = createPromiseClient(
    Service,
    createRouterTransport(({ service }) => {
      service(Service, {
        getAtmosphereTimeline: ({ cursor }) => {
          timelineCalls.push(cursor)
          return {
            items: rows.map(({ uri, time }) => ({
              uri,
              sortedAt: Timestamp.fromDate(new Date(time)),
            })),
            cursor: '',
          }
        },
        getRecordsByURI: ({ uris }) => ({
          results: uris.map((uri) => {
            const record = records.get(uri as AtUriString)
            return {
              ref: { uri, cid },
              status: record
                ? RecordLookupStatus.FOUND
                : RecordLookupStatus.NOT_FOUND,
              record: record
                ? { cid, record: Buffer.from(lexStringify(record)) }
                : undefined,
            }
          }),
        }),
        getAtmosphereBacklinkCounts: ({ targetUris }) => ({
          results: targetUris.map((targetUri) => ({ targetUri, counts: {} })),
        }),
        getAtmosphereBacklinks: () => ({ backlinks: [] }),
        getAtmosphereBacklinksByActor: ({ targetUris }) => ({
          results: targetUris.map((targetUri) => {
            const subscription = subscriptions.get(targetUri as AtUriString)
            return { targetUri, uris: subscription ? [subscription] : [] }
          }),
          truncated: false,
        }),
        getActors: ({ dids }) => ({
          actors: dids.map(() => ({ exists: true, handle: 'actor.test' })),
        }),
        getRelationships: ({ targetDids }) => ({
          relationships: targetDids.map((did) => ({ muted: muted.has(did) })),
        }),
        getLabels: () => ({ labels: [] }),
      })
    }),
  )
  const featureGatesClient = new FeatureGatesClient({})
  const hydrator = new Hydrator(dataplane, [], {
    debugFieldAllowedDids: new Set(),
    featureGatesClient,
  })
  const views = new Views({
    imgUriBuilder: new ImageUriBuilder('https://images.example.com'),
    videoUriBuilder: new VideoUriBuilder({
      playlistUrlPattern: '',
      thumbnailUrlPattern: '',
    }),
    indexedAtEpoch: undefined,
    threadTagsBumpDown: [],
    threadTagsHide: [],
    visibilityTagHide: '',
    visibilityTagRankPrefix: '',
  })
  const scope = vi
    .spyOn(featureGatesClient, 'scope')
    .mockImplementation(() => ({
      Gate,
      checkGate: (gate) =>
        enabled && gate === Gate.AtmosphereScreenEndpointsEnable,
      checkGates: (gates) =>
        new Map(
          gates.map((gate) => [
            gate,
            enabled && gate === Gate.AtmosphereScreenEndpointsEnable,
          ]),
        ),
    }))
  const ctx = {
    hydrator,
    views,
    featureGatesClient,
    reqLabelers: () => ({ dids: [], redact: new Set() }),
    authVerifier: {
      standard: async ({ req }) => {
        if (req.headers.authorization !== 'Bearer viewer')
          throw new AuthRequiredError()
        return {
          credentials: {
            type: 'standard',
            iss: viewer,
            aud: 'did:plc:appview',
          },
        }
      },
    } satisfies Pick<AppContext['authVerifier'], 'standard'>,
  } as unknown as AppContext
  // @NOTE Response validation checks every response against the lexicon.
  const xrpc = createServer([], { validateResponse: true })
  register(xrpc, ctx)
  const server = createHttpServer(xrpc.router)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('No HTTP address')
  return {
    muted,
    subscriptions,
    timelineCalls,
    setEnabled(value: boolean) {
      enabled = value
    },
    async query(authorization: string | undefined = 'Bearer viewer') {
      const url = `http://127.0.0.1:${address.port}/xrpc/${endpoint.$lxm}`
      const response = await fetch(url, {
        headers: authorization ? { authorization } : {},
      })
      return {
        status: response.status,
        body: (await response.json()) as app.bsky.unspecced.getAtmosphereTimelineV2.$OutputBody,
      }
    },
    async [Symbol.asyncDispose]() {
      scope.mockRestore()
      await server[Symbol.asyncDispose]()
    },
  }
}

const alice = 'did:plc:alice'
const bob = 'did:plc:bob'
const publication = atUri(alice, site.standard.publication.$type, 'pub')
const newArticle = atUri(alice, site.standard.document.$type, 'new')
const oldArticle = atUri(bob, site.standard.document.$type, 'old')
const subscription = atUri(viewer, site.standard.graph.subscription.$type, 's')

function recommendation(actor: DidString, document: AtUriString, age: number) {
  return {
    uri: atUri(actor, site.standard.graph.recommend.$type, `rec${age}`),
    time: now - age * minute,
    record: site.standard.graph.recommend.$build({
      document,
      createdAt: toDatetimeString(now - age * minute),
    }),
  }
}

function article(siteUri: string, title: string) {
  return site.standard.document.$build({
    title,
    site: siteUri as site.standard.document.Main['site'],
    path: '/story',
    publishedAt: toDatetimeString(now),
  })
}

describe('Atmosphere timeline V2 HTTP endpoint', () => {
  it('requires authentication and gates access before timeline reads', async () => {
    await using fixture = await setup([], new Map())
    expect((await fixture.query('')).status).toBe(401)
    fixture.setEnabled(false)
    expect((await fixture.query()).status).toBe(403)
    expect(fixture.timelineCalls).toEqual([])
  })

  it('groups visible activity without shares or publications, references actor profiles, and includes viewer subscriptions', async () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const recommendations = [
      recommendation('did:plc:r1', oldArticle, 1),
      recommendation('did:plc:muted', oldArticle, 2),
      recommendation('did:plc:r2', newArticle, 3),
      recommendation('did:plc:r3', oldArticle, 5),
    ]
    const rows = [
      // @NOTE Bluesky post shares and publication creations are never V2 activity.
      { uri: atUri(bob, app.bsky.feed.post.$type, 'share'), time: now },
      { uri: publication, time: now },
      ...recommendations.slice(0, 3),
      { uri: newArticle, time: now - 4 * minute },
      recommendations[3],
    ]
    const records = new Map<AtUriString, TypedLexMap>([
      [newArticle, article(publication, 'New')],
      [oldArticle, article('https://bob.example.com', 'Old')],
      [
        publication,
        site.standard.publication.$build({
          name: 'Publication',
          url: 'https://alice.example.com',
        }),
      ],
      ...recommendations.map(
        ({ uri, record }) => [uri, record] as [AtUriString, TypedLexMap],
      ),
    ])
    await using fixture = await setup(rows, records)
    fixture.muted.add('did:plc:muted')
    fixture.subscriptions.set(publication, subscription)

    const { status, body } = await fixture.query()

    expect(status).toBe(200)
    expect(body.cursor).toBeUndefined()
    expect(body.feed).toMatchObject([
      {
        $type: endpoint.activitySubjectGroup.$type,
        collection: site.standard.graph.recommend.$type,
        subject: { ref: { uri: oldArticle, cid }, view: { title: 'Old' } },
        activities: [recommendations[0], recommendations[3]].map(({ uri }) => ({
          ref: { uri, cid },
        })),
      },
      {
        $type: endpoint.activityItem.$type,
        ref: { uri: newArticle, cid },
        indexedAt: toDatetimeString(now - 4 * minute),
        actor: alice,
        subject: {
          ref: { uri: newArticle, cid },
          view: { publisher: { viewer: { subscription } } },
        },
        relatedActivity: [
          { ref: { uri: recommendations[2].uri }, actor: 'did:plc:r2' },
        ],
      },
    ])
    expect(body.relatedViews).toMatchObject(
      ['did:plc:r1', 'did:plc:r3', alice, 'did:plc:r2'].map((did) => ({
        $type: app.bsky.actor.defs.profileViewBasic.$type,
        did,
      })),
    )
  })
  it('omits ended livestreams and keeps live ones standalone', async () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const ago = (minutes: number) => toDatetimeString(now - minutes * minute)
    const streams = {
      live: { lastSeenAt: ago(1) },
      justStarted: { createdAt: ago(1) },
      stale: { lastSeenAt: ago(3) },
      ended: { lastSeenAt: ago(0), endedAt: ago(1) },
      noRecentHeartbeat: { createdAt: ago(3) },
    }
    const rows = Object.keys(streams).map((rkey, i) => ({
      uri: atUri(alice, place.stream.livestream.$type, rkey),
      time: now - i * minute,
    }))
    const records = new Map<AtUriString, TypedLexMap>(
      Object.values(streams).map((fields, i) => [
        rows[i].uri,
        place.stream.livestream.$build({
          title: 'Stream',
          url: 'https://stream.example.com',
          createdAt: ago(60),
          ...fields,
        }),
      ]),
    )
    await using fixture = await setup(rows, records)

    const { status, body } = await fixture.query()

    expect(status).toBe(200)
    expect(body.feed).toMatchObject(
      rows.slice(0, 2).map(({ uri }) => ({
        $type: endpoint.activityItem.$type,
        ref: { uri },
        subject: { view: { active: true } },
      })),
    )
  })
})
