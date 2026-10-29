import { once } from 'node:events'
import { createServer as createHttpServer } from 'node:http'
import { Timestamp } from '@bufbuild/protobuf'
import {
  Code,
  ConnectError,
  createPromiseClient,
  createRouterTransport,
} from '@connectrpc/connect'
import { describe, expect, it, vi } from 'vitest'
import {
  type AtUriString,
  type DidString,
  atUri,
  lexStringify,
  toDatetimeString,
} from '@atproto/lex'
import { AuthRequiredError, createServer } from '@atproto/xrpc-server'
import register from '../src/api/app/bsky/unspecced/getAtmosphereTimeline.js'
import type { AppContext } from '../src/context.js'
import { Gate } from '../src/feature-gates/gates.js'
import { FeatureGatesClient } from '../src/feature-gates/index.js'
import { Hydrator } from '../src/hydration/hydrator.js'
import { ImageUriBuilder } from '../src/image/uri.js'
import { app, site } from '../src/lexicons/index.js'
import { Service } from '../src/proto/bsky_connect.js'
import { RecordLookupStatus } from '../src/proto/bsky_pb.js'
import { Views } from '../src/views/index.js'
import { VideoUriBuilder } from '../src/views/util.js'

const endpoint = app.bsky.unspecced.getAtmosphereTimeline
const viewer = 'did:plc:viewer'
const cid = 'bafyreie5sviu7eeu3vf6n3lrlmqef2vdlwmgzd6zpolov56agdxtshdpda'
const now = Date.parse('2026-10-29T12:00:00.000Z')
const minute = 60_000

type Row = { uri: AtUriString; time: number }
function row(
  index: number,
  age = index * 1000,
  author: DidString = `did:plc:author${index}`,
): Row {
  return {
    uri: atUri(author, site.standard.document.$type, `story${index}`),
    time: now - age,
  }
}
function rows(count: number, start = 0): Row[] {
  return Array.from({ length: count }, (_, i) => row(start + i))
}
function batches(items: Row[]): Row[][] {
  return Array.from({ length: Math.ceil(items.length / 50) }, (_, i) =>
    items.slice(i * 50, i * 50 + 50),
  )
}
function nativeCursor(index: number): string {
  return `opaque-native-chain|${index}|1000-boundary`
}

async function setup(pages: Row[][]) {
  const records = new Map<AtUriString, site.standard.document.Main>()
  for (const item of pages.flat()) {
    records.set(
      item.uri,
      site.standard.document.$build({
        title: item.uri,
        site: 'https://articles.example.com',
        path: '/story',
        publishedAt: toDatetimeString(item.time),
      }),
    )
  }
  const blocked = new Set<string>()
  const muted = new Set<string>()
  const takenDown = new Set<string>()
  const missingActors = new Set<string>()
  const timelineCalls: { viewerDid: string; limit: number; cursor: string }[] =
    []
  const lookups: string[][] = []
  const actorLookups: string[][] = []
  let enabled = true
  let failure: ConnectError | undefined
  let repeated = false
  const dataplane = createPromiseClient(
    Service,
    createRouterTransport(({ service }) => {
      service(Service, {
        getAtmosphereTimeline: ({ viewerDid, limit, cursor }) => {
          timelineCalls.push({ viewerDid, limit, cursor })
          if (failure) throw failure
          const index = cursor
            ? pages.findIndex((_, i) => nativeCursor(i) === cursor)
            : 0
          if (index < 0)
            throw new ConnectError(
              'unknown native cursor',
              Code.InvalidArgument,
            )
          return {
            items: (pages[index] ?? []).map(({ uri, time }) => ({
              uri,
              sortedAt: Timestamp.fromDate(new Date(time)),
            })),
            cursor: repeated
              ? nativeCursor(0)
              : index + 1 < pages.length
                ? nativeCursor(index + 1)
                : '',
          }
        },
        getRecordsByURI: ({ uris }) => {
          expect(uris.length).toBeLessThanOrEqual(100)
          lookups.push(uris)
          return {
            results: uris.map((uri) => {
              const record = records.get(uri as AtUriString)
              return {
                ref: { uri, cid },
                status: takenDown.has(uri)
                  ? RecordLookupStatus.TAKEN_DOWN
                  : record
                    ? RecordLookupStatus.FOUND
                    : RecordLookupStatus.NOT_FOUND,
                record: record
                  ? { cid, record: Buffer.from(lexStringify(record)) }
                  : undefined,
              }
            }),
          }
        },
        getAtmosphereBacklinkCounts: ({ targetUris }) => ({
          results: targetUris.map((targetUri) => ({ targetUri, counts: {} })),
        }),
        getAtmosphereBacklinks: () => ({ backlinks: [] }),
        getAtmosphereBacklinksByActor: () => ({
          results: [],
          truncated: false,
        }),
        getActors: ({ dids }) => {
          actorLookups.push(dids)
          return {
            actors: dids.map((did) => ({
              exists: !missingActors.has(did),
              handle: 'author.test',
            })),
          }
        },
        getRelationships: ({ targetDids }) => ({
          relationships: targetDids.map((did) => ({
            following: atUri(viewer, app.bsky.graph.follow.$type, 'follow'),
            blockedBy: blocked.has(did)
              ? atUri(did as DidString, app.bsky.graph.block.$type, 'block')
              : '',
            muted: muted.has(did),
          })),
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
        if (
          req.headers.authorization !== 'Bearer viewer' &&
          req.headers.authorization !== 'Bearer other'
        )
          throw new AuthRequiredError()
        return {
          credentials: {
            type: 'standard',
            iss:
              req.headers.authorization === 'Bearer other'
                ? 'did:plc:other'
                : viewer,
            aud: 'did:plc:appview',
          },
        }
      },
    } satisfies Pick<AppContext['authVerifier'], 'standard'>,
  } as unknown as AppContext
  const xrpc = createServer([], { validateResponse: true })
  register(xrpc, ctx)
  const server = createHttpServer(xrpc.router)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('No HTTP address')
  return {
    records,
    blocked,
    muted,
    takenDown,
    missingActors,
    timelineCalls,
    lookups,
    actorLookups,
    hydrator,
    setEnabled(value: boolean) {
      enabled = value
    },
    setFailure(value: ConnectError) {
      failure = value
    },
    repeatCursor() {
      repeated = true
    },
    async query(
      cursor?: string,
      authorization: string | undefined = 'Bearer viewer',
    ) {
      const url = new URL(
        `http://127.0.0.1:${address.port}/xrpc/${endpoint.$lxm}`,
      )
      if (cursor !== undefined) url.searchParams.set('cursor', cursor)
      const response = await fetch(url, {
        headers: authorization ? { authorization } : {},
      })
      return {
        status: response.status,
        headers: response.headers,
        body: (await response.json()) as app.bsky.unspecced.getAtmosphereTimeline.$OutputBody,
      }
    },
    async [Symbol.asyncDispose]() {
      scope.mockRestore()
      await server[Symbol.asyncDispose]()
    },
  }
}

function activities(
  body: app.bsky.unspecced.getAtmosphereTimeline.$OutputBody,
): app.bsky.unspecced.getAtmosphereTimeline.AtmosphereItem[] {
  return body.feed.flatMap((entry) =>
    endpoint.atmosphereGroup.$isTypeOf(entry)
      ? entry.items
      : endpoint.atmosphereItem.$isTypeOf(entry)
        ? [entry]
        : [],
  )
}

describe('Atmosphere timeline HTTP endpoint', () => {
  it('requires authentication and gates access before timeline reads', async () => {
    await using fixture = await setup([rows(1)])
    expect((await fixture.query(undefined, '')).status).toBe(401)
    expect((await fixture.query(undefined, 'Bearer invalid')).status).toBe(401)
    fixture.setEnabled(false)
    expect((await fixture.query()).status).toBe(403)
    expect(fixture.timelineCalls).toEqual([])
    expect(fixture.lookups).toEqual([])
  })

  it('stops after 250 retained roots and resumes the unchanged native chain past 1000', async () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const items = rows(1250)
    await using fixture = await setup(batches(items))
    let cursor: string | undefined
    const received: string[] = []
    for (let page = 0; page < 5; page++) {
      const response = await fixture.query(cursor)
      expect(response.status).toBe(200)
      expect(response.headers.has('atproto-content-labelers')).toBe(true)
      expect(activities(response.body).map(({ record }) => record.uri)).toEqual(
        items.slice(page * 250, (page + 1) * 250).map(({ uri }) => uri),
      )
      received.push(
        ...activities(response.body).map(({ record }) => record.uri),
      )
      cursor = response.body.cursor
      if (page < 4) {
        expect(cursor).toBeDefined()
        expect(
          JSON.parse(Buffer.from(cursor!, 'base64url').toString()).cursor,
        ).toBe(nativeCursor((page + 1) * 5))
      }
    }
    expect(cursor).toBeUndefined()
    expect(new Set(received).size).toBe(1250)
    expect(fixture.timelineCalls.map(({ cursor }) => cursor)).toEqual(
      Array.from({ length: 25 }, (_, i) => (i ? nativeCursor(i) : '')),
    )
    expect(
      fixture.timelineCalls.every(
        ({ limit, viewerDid }) => limit === 50 && viewerDid === viewer,
      ),
    ).toBe(true)
    const fetched = fixture.lookups.flat()
    expect(fetched).toEqual(items.map(({ uri }) => uri))
  })

  it('keeps the whole batch on both sides of a qualifying gap and hydrates incrementally', async () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const items = rows(200).map((item, i) => ({
      ...item,
      time: now - (i < 110 ? i * 1000 : 40 * minute + i * 1000),
    }))
    await using fixture = await setup(batches(items))
    const response = await fixture.query()
    expect(response.status).toBe(200)
    expect(activities(response.body).map(({ record }) => record.uri)).toEqual(
      items.slice(0, 150).map(({ uri }) => uri),
    )
    expect(
      JSON.parse(Buffer.from(response.body.cursor!, 'base64url').toString())
        .cursor,
    ).toBe(nativeCursor(3))
    expect(fixture.lookups.flat()).toEqual(
      items.slice(0, 150).map(({ uri }) => uri),
    )
    expect(fixture.timelineCalls).toHaveLength(3)
  })

  it('ignores early gaps until ten visible records and uses strict rather than inclusive gap size', async () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const items = rows(150).map((item, i) => ({
      ...item,
      time: now - (i < 5 ? i * 1000 : i < 10 ? 31 * minute : 61 * minute),
    }))
    await using fixture = await setup(batches(items))
    const response = await fixture.query()
    expect(response.status).toBe(200)
    expect(activities(response.body).map(({ record }) => record.uri)).toEqual(
      items.map(({ uri }) => uri),
    )
    expect(fixture.timelineCalls).toHaveLength(3)
  })

  it('counts hidden and missing retained roots toward 200, not just visible roots', async () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const items = rows(300)
    await using fixture = await setup(batches(items))
    for (const item of items.slice(0, 245)) fixture.records.delete(item.uri)
    const response = await fixture.query()
    expect(response.status).toBe(200)
    expect(activities(response.body).map(({ record }) => record.uri)).toEqual(
      items.slice(245, 250).map(({ uri }) => uri),
    )
    expect(fixture.timelineCalls).toHaveLength(5)
    expect(fixture.lookups.flat()).toEqual(
      items.slice(0, 250).map(({ uri }) => uri),
    )
  })

  it('deduplicates before capping each author/collection and positions overflow at the sixth record', async () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const alice = 'did:plc:alice'
    const aliceRows = Array.from({ length: 17 }, (_, i) =>
      row(
        i,
        now - Date.parse('2026-10-01T00:00:00Z') + i * 9 * 60 * minute,
        alice,
      ),
    )
    const bob = row(100, 0, 'did:plc:bob')
    const items = [
      ...aliceRows.slice(0, 5),
      bob,
      ...aliceRows.slice(5),
      aliceRows[7],
    ]
    await using fixture = await setup([items.slice(0, 12), items.slice(12)])
    const response = await fixture.query()
    expect(response.status).toBe(200)
    const overflow = response.body.feed.filter(
      endpoint.atmosphereItemOverflow.$isTypeOf,
    )
    expect(overflow).toEqual([
      expect.objectContaining({
        count: 12,
        collection: site.standard.document.$type,
        associatedProfiles: [expect.objectContaining({ did: alice })],
      }),
    ])
    expect(response.body.feed.indexOf(overflow[0])).toBe(6)
    expect(fixture.lookups.flat()).toEqual([
      ...aliceRows.slice(0, 5).map(({ uri }) => uri),
      bob.uri,
    ])
    expect(activities(response.body)).toHaveLength(6)
  })

  it.each(['blocked', 'muted', 'missingActors'] as const)(
    'hides %s authors and their overflow without fetching omitted records',
    async (kind) => {
      using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
      const alice = 'did:plc:alice'
      const items = Array.from({ length: 17 }, (_, i) =>
        row(i, i * 1000, alice),
      )
      await using fixture = await setup([items])
      fixture[kind].add(alice)
      expect((await fixture.query()).body.feed).toEqual([])
      expect(fixture.lookups.flat()).toEqual(
        items.slice(0, 5).map(({ uri }) => uri),
      )
    },
  )

  it.each([
    { age: 59 * minute, window: 30 * minute },
    { age: 60 * minute, window: 60 * minute },
    { age: 12 * 60 * minute, window: 60 * minute },
    { age: 12 * 60 * minute + 1, window: 4 * 60 * minute },
    { age: 24 * 60 * minute, window: 4 * 60 * minute },
    { age: 365 * 24 * 60 * minute, window: 8 * 60 * minute },
  ])(
    'uses the newer visible root for the gap at age $age',
    async ({ age, window }) => {
      using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
      for (const extra of [0, 1]) {
        const items = rows(150).map((item, i) => ({
          ...item,
          time: now - age - (i < 10 ? 0 : window + extra),
        }))
        await using fixture = await setup(batches(items))
        const response = await fixture.query()
        expect(response.status).toBe(200)
        expect(
          activities(response.body).map(({ record }) => record.uri),
        ).toEqual(items.slice(0, extra ? 100 : 150).map(({ uri }) => uri))
        expect(fixture.timelineCalls).toHaveLength(extra ? 2 : 3)
      }
    },
  )

  it('rejects malformed and cross-viewer cursors instead of restarting the native chain', async () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    await using fixture = await setup(batches(rows(300)))
    for (const invalid of [
      'native-cursor',
      '*invalid*',
      Buffer.from('{"v":2}').toString('base64url'),
    ]) {
      expect((await fixture.query(invalid)).status).toBe(400)
    }
    expect(fixture.timelineCalls).toEqual([])
    const first = await fixture.query()
    expect(first.body.cursor).toBeDefined()
    const count = fixture.timelineCalls.length
    expect(
      (await fixture.query(first.body.cursor, 'Bearer other')).status,
    ).toBe(400)
    expect(fixture.timelineCalls).toHaveLength(count)
  })

  it('fails repeated native cursors and preserves native invalid-argument errors', async () => {
    await using fixture = await setup(batches(rows(100)))
    fixture.repeatCursor()
    expect((await fixture.query()).status).toBe(502)
    expect(fixture.timelineCalls).toHaveLength(2)
    fixture.setFailure(new ConnectError('expired', Code.InvalidArgument))
    expect((await fixture.query()).status).toBe(400)
  })
})
