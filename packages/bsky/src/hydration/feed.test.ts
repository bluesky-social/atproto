import { setTimeout } from 'node:timers/promises'
import {
  Code,
  ConnectError,
  createPromiseClient,
  createRouterTransport,
} from '@connectrpc/connect'
import { describe, expect, it, test, vi } from 'vitest'
import { atUri } from '@atproto/lex'
import { app } from '../lexicons/index.js'
import { Service } from '../proto/bsky_connect.js'
import {
  type Feature,
  FeatureStore,
  type GetFeaturesRequest,
  GetFeaturesResponse,
} from '../proto/bsky_pb.js'
import { FeedHydrator } from './feed.js'

const uri = atUri('did:plc:alice', app.bsky.feed.post.$type, '1')

function fixture(value: Feature['value']) {
  const getFeatures = vi.fn<(req: GetFeaturesRequest) => GetFeaturesResponse>(
    () =>
      new GetFeaturesResponse({
        entities: [{ uid: uri, features: [{ key: 'unique_views', value }] }],
      }),
  )
  const dataplane = createPromiseClient(
    Service,
    createRouterTransport((router) => {
      router.service(Service, { getFeatures })
    }),
  )
  return { feed: new FeedHydrator(dataplane), getFeatures }
}

describe('post view count hydration', () => {
  test.each([
    {
      note: 'below threshold',
      value: { case: 'sint64Val', value: 99n },
      expected: undefined,
    },
    {
      note: 'at threshold',
      value: { case: 'sint64Val', value: 100n },
      expected: 100,
    },
    {
      note: 'above threshold',
      value: { case: 'sint64Val', value: 101n },
      expected: 101,
    },
    {
      note: 'legacy integer',
      value: { case: 'sintVal', value: 123 },
      expected: 123,
    },
    {
      note: 'negative',
      value: { case: 'sint64Val', value: -1n },
      expected: undefined,
    },
    {
      note: 'unsafe integer',
      value: { case: 'sint64Val', value: 9007199254740992n },
      expected: undefined,
    },
    {
      note: 'string',
      value: { case: 'stringVal', value: '100' },
      expected: undefined,
    },
    {
      note: 'float',
      value: { case: 'floatVal', value: 100 },
      expected: undefined,
    },
    { note: 'missing value', value: { case: undefined }, expected: undefined },
  ] satisfies {
    note: string
    value: Feature['value']
    expected: number | undefined
  }[])('$note', async ({ value, expected }) => {
    const { feed, getFeatures } = fixture(value)
    expect((await feed.getPostViewCounts([uri])).get(uri)).toBe(expected)
    expect(getFeatures.mock.calls[0]?.[0]).toMatchObject({
      store: FeatureStore.POST,
      requests: [{ uid: uri, keys: ['unique_views'] }],
    })
  })

  it('does not query an empty batch', async () => {
    const { feed, getFeatures } = fixture({ case: 'sint64Val', value: 100n })
    expect((await feed.getPostViewCounts([])).size).toBe(0)
    expect(getFeatures).not.toHaveBeenCalled()
  })

  it('bounds and deduplicates batches, matches by UID, and ignores unsolicited entries', async () => {
    const uris = Array.from({ length: 101 }, (_, i) =>
      atUri('did:plc:alice', app.bsky.feed.post.$type, String(i)),
    )
    const batches: number[] = []
    const dataplane = createPromiseClient(
      Service,
      createRouterTransport((router) => {
        router.service(Service, {
          getFeatures: (req) => {
            batches.push(req.requests.length)
            return new GetFeaturesResponse({
              entities: [
                ...req.requests.toReversed().map(({ uid }) => ({
                  uid,
                  features: [
                    {
                      key: 'unique_views',
                      value: { case: 'sint64Val' as const, value: 100n },
                    },
                  ],
                })),
                {
                  uid: 'unsolicited',
                  features: [
                    {
                      key: 'unique_views',
                      value: { case: 'sint64Val', value: 999n },
                    },
                  ],
                },
              ],
            })
          },
        })
      }),
    )
    const counts = await new FeedHydrator(dataplane).getPostViewCounts([
      ...uris,
      ...uris,
    ])
    expect(batches).toEqual([100, 1])
    expect([...counts.keys()]).toEqual(uris)
    expect([...counts.values()]).toEqual(uris.map(() => 100))
  })

  it('omits counts when the feature or entity is missing', async () => {
    const { feed, getFeatures } = fixture({ case: 'sint64Val', value: 100n })
    getFeatures.mockReturnValue(
      new GetFeaturesResponse({
        entities: [
          {
            uid: uri,
            features: [
              { key: 'another_key', value: { case: 'sint64Val', value: 100n } },
            ],
          },
        ],
      }),
    )
    expect((await feed.getPostViewCounts([uri])).size).toBe(0)
    getFeatures.mockReturnValue(new GetFeaturesResponse())
    expect((await feed.getPostViewCounts([uri])).size).toBe(0)
  })

  it('discards partial results when a later batch fails', async () => {
    const { feed, getFeatures } = fixture({ case: 'sint64Val', value: 100n })
    getFeatures
      .mockImplementationOnce(
        () =>
          new GetFeaturesResponse({
            entities: [
              {
                uid: uri,
                features: [
                  {
                    key: 'unique_views',
                    value: { case: 'sint64Val', value: 100n },
                  },
                ],
              },
            ],
          }),
      )
      .mockImplementationOnce(() => {
        throw new ConnectError('unavailable', Code.Unavailable)
      })
    const uris = Array.from({ length: 101 }, (_, i) =>
      atUri('did:plc:alice', app.bsky.feed.post.$type, String(i + 1)),
    )
    expect((await feed.getPostViewCounts(uris)).size).toBe(0)
    expect(getFeatures).toHaveBeenCalledTimes(2)
  })

  it('aborts a slow optional lookup and omits the count', async () => {
    const dataplane = createPromiseClient(
      Service,
      createRouterTransport((router) => {
        router.service(Service, {
          getFeatures: async (_req, ctx) => {
            await setTimeout(10_000, undefined, { signal: ctx.signal })
            return new GetFeaturesResponse()
          },
        })
      }),
    )
    expect(
      (await new FeedHydrator(dataplane).getPostViewCounts([uri])).size,
    ).toBe(0)
  })
})
