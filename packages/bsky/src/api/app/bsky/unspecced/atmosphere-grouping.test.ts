import { describe, expect, it, vi } from 'vitest'
import {
  type AtUriString,
  type NsidString,
  asAtUriString,
  asStringFormat,
  toDatetimeString,
} from '@atproto/lex'
import { app, place, site, social } from '../../../../lexicons/index.js'
import {
  type TimelineActivity,
  type TimelineEntry,
  type TimelineHydration,
  atmosphereWindow,
  groupAtmosphereActivities,
} from './atmosphere-grouping.js'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const now = Date.parse('2026-10-29T12:00:00.000Z')
const timeline = app.bsky.unspecced.getAtmosphereTimeline
const document = site.standard.document.$type
const recommend = site.standard.graph.recommend.$type
const share = app.bsky.feed.post.$type
const subscription = site.standard.graph.subscription.$type
const favorite = social.grain.favorite.$type
const gallery = social.grain.gallery.$type
const livestream = place.stream.livestream.$type

function activity(
  id: string,
  age: number,
  collection: NsidString = document,
  options: {
    author?: string
    target?: AtUriString
    groupable?: boolean
    subscribed?: boolean
    ended?: boolean
  } = {},
): TimelineActivity {
  const uri = asAtUriString(
    `at://did:plc:${options.author ?? 'alice'}/${collection}/${id}`,
  )
  return {
    sortedAt: now - age,
    target: options.target,
    groupable:
      options.groupable ??
      (collection !== livestream || options.ended === true),
    item: timeline.activityItem.$build({
      record: {
        uri,
        cid: asStringFormat(
          'bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
          'cid',
        ),
        indexedAt: toDatetimeString(new Date(now - age)),
      },
      collection,
      viewerState: { subscribed: options.subscribed ?? false },
    }),
  }
}

function hydration() {
  return {
    item: vi.fn<TimelineHydration['item']>((activity) =>
      timeline.activityItem.$build({
        ...activity.item,
        view: app.bsky.embed.external.viewArticle.$build({
          uri: activity.item.record.uri,
          title: 'Timeline item',
          description: '',
        }),
      }),
    ),
    subject: vi.fn<TimelineHydration['subject']>((activity) => {
      const uri =
        activity.item.collection === document
          ? activity.item.record.uri
          : activity.target!
      const fields = { uri, title: 'Subject', description: '' }
      const view =
        activity.item.collection === favorite
          ? app.bsky.embed.external.viewGallery.$build({ ...fields, items: [] })
          : activity.item.collection === subscription
            ? app.bsky.embed.external.viewArticlePublication.$build(fields)
            : app.bsky.embed.external.viewArticle.$build(fields)
      return timeline.activitySubject.$build({
        uri,
        viewerState: activity.item.viewerState,
        view,
        ...(activity.item.collection === share
          ? {
              bskyPostRef: {
                uri: activity.item.record.uri,
                cid: activity.item.record.cid,
              },
            }
          : {}),
      })
    }),
    profile: vi.fn<TimelineHydration['profile']>((did) =>
      app.bsky.actor.defs.profileViewBasic.$build({
        did,
        handle: asStringFormat(`${did.split(':').at(-1)}.test`, 'handle'),
      }),
    ),
  }
}

function rootUris(feed: TimelineEntry[]): AtUriString[][] {
  return feed.map((entry) =>
    'activities' in entry
      ? entry.activities.map((activity) => activity.record.uri)
      : 'uris' in entry
        ? entry.uris
        : [entry.record.uri],
  )
}

function allUris(feed: TimelineEntry[]): AtUriString[] {
  return [
    ...rootUris(feed).flat(),
    ...feed.flatMap((entry) =>
      'record' in entry
        ? (entry.relatedActivity ?? []).flatMap((group) =>
            group.activities.map((activity) => activity.record.uri),
          )
        : [],
    ),
  ]
}

function expectConserved(feed: TimelineEntry[], input: TimelineActivity[]) {
  expect(allUris(feed).sort()).toEqual(
    input.map(({ item }) => item.record.uri).sort(),
  )
  expect(new Set(allUris(feed)).size).toBe(input.length)
}

describe(atmosphereWindow, () => {
  it.each([
    [-1, 30 * MINUTE],
    [0, 30 * MINUTE],
    [HOUR - 1, 30 * MINUTE],
    [HOUR, HOUR],
    [HOUR + 1, HOUR],
    [12 * HOUR - 1, HOUR],
    [12 * HOUR, HOUR],
    [12 * HOUR + 1, 4 * HOUR],
    [24 * HOUR - 1, 4 * HOUR],
    [24 * HOUR, 4 * HOUR],
    [24 * HOUR + 1, 8 * HOUR],
  ])('selects the exact age boundary %i', (age, expected) => {
    expect(atmosphereWindow(age)).toBe(expected)
  })
})

describe(groupAtmosphereActivities, () => {
  it('attaches lightweight article actions by collection without moving the creation or imposing a time limit', () => {
    const article = activity('article', 30 * 24 * HOUR, document, {
      author: 'carol',
      subscribed: true,
      groupable: false,
    })
    const rec = activity('rec', 0, recommend, {
      target: article.item.record.uri,
      author: 'bob',
      groupable: false,
    })
    const shared = activity('share', HOUR, share, {
      target: article.item.record.uri,
      groupable: false,
    })
    const between = activity('between', 2 * HOUR, gallery)
    const input = [rec, shared, between, article]
    const views = hydration()
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual([
      [between.item.record.uri],
      [article.item.record.uri],
    ])
    expect(result[1]).toMatchObject({
      $type: timeline.activityItem.$type,
      record: article.item.record,
      viewerState: { subscribed: true },
      relatedActivity: [
        {
          collection: recommend,
          activities: [{ record: rec.item.record, collection: recommend }],
          actors: [{ did: 'did:plc:bob' }],
        },
        {
          collection: share,
          activities: [{ record: shared.item.record, collection: share }],
          actors: [{ did: 'did:plc:alice' }],
        },
      ],
    })
    if (!('record' in result[1])) throw new Error('Expected article item')
    for (const group of result[1].relatedActivity ?? []) {
      expect(group).not.toHaveProperty('view')
      expect(group).not.toHaveProperty('subject')
      for (const item of group.activities) {
        expect(item).not.toHaveProperty('view')
        expect(item).not.toHaveProperty('relatedActivity')
      }
    }
    expect(views.subject).not.toHaveBeenCalled()
    expect(views.item.mock.calls).toEqual([[article], [between]])
    expect(views.profile.mock.calls).toEqual([
      ['did:plc:bob'],
      ['did:plc:alice'],
    ])
    expect(article.item).not.toHaveProperty('relatedActivity')
    expectConserved(result, input)
  })

  it('subject-groups article actions page-wide only within each collection and deduplicates actors', () => {
    const target = activity('missing', HOUR).item.record.uri
    const input = [
      activity('share1', 0, share, { target, author: 'bob' }),
      activity('rec1', HOUR, recommend, { target }),
      activity('rec2', 30 * 24 * HOUR, recommend, { target, author: 'bob' }),
      activity('share2', 60 * 24 * HOUR, share, { target, author: 'carol' }),
      activity('share3', 90 * 24 * HOUR, share, { target, author: 'bob' }),
    ]
    const views = hydration()
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual([
      [
        input[0].item.record.uri,
        input[3].item.record.uri,
        input[4].item.record.uri,
      ],
      [input[1].item.record.uri, input[2].item.record.uri],
    ])
    expect(result).toMatchObject([
      {
        $type: timeline.activitySubjectGroup.$type,
        id: `subject:${input[0].item.record.uri}`,
        indexedAt: input[0].item.record.indexedAt,
        collection: share,
        subject: { uri: target },
        actors: [{ did: 'did:plc:bob' }, { did: 'did:plc:carol' }],
      },
      {
        $type: timeline.activitySubjectGroup.$type,
        id: `subject:${input[1].item.record.uri}`,
        indexedAt: input[1].item.record.indexedAt,
        collection: recommend,
        subject: { uri: target },
        actors: [{ did: 'did:plc:alice' }, { did: 'did:plc:bob' }],
      },
    ])
    expect(views.subject.mock.calls).toEqual([[input[0]], [input[1]]])
    expect(views.profile.mock.calls).toEqual([
      ['did:plc:bob'],
      ['did:plc:carol'],
      ['did:plc:alice'],
      ['did:plc:bob'],
    ])
    expect(views.item).not.toHaveBeenCalled()
    expectConserved(result, input)
  })

  it('does not create a subject group from different collections with only one action each', () => {
    const target = activity('missing', HOUR).item.record.uri
    const input = [
      activity('rec', 0, recommend, { target }),
      activity('share', MINUTE, share, { target, author: 'bob' }),
    ]
    const views = hydration()
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual(input.map(({ item }) => [item.record.uri]))
    expect(result.every(timeline.activityItem.$isTypeOf)).toBe(true)
    expect(views.subject).not.toHaveBeenCalled()
    expect(views.profile).not.toHaveBeenCalled()
    expectConserved(result, input)
  })

  it.each([recommend, share, subscription, favorite] as const)(
    'requires distinct actors for subject grouping of %s and preserves actor windows',
    (collection) => {
      const target = activity('missing', HOUR).item.record.uri
      const input = [
        activity('one', 0, collection, { target }),
        activity('two', MINUTE, collection, { target }),
        activity('old', 60 * 24 * HOUR, collection, { target }),
      ]
      const views = hydration()
      const result = groupAtmosphereActivities(input, now, views)
      expect(rootUris(result)).toEqual(
        collection === share
          ? input.map(({ item }) => [item.record.uri])
          : [
              [input[0].item.record.uri, input[1].item.record.uri],
              [input[2].item.record.uri],
            ],
      )
      expect(result[0].$type).toBe(
        collection === share
          ? timeline.activityItem.$type
          : timeline.activityActorGroup.$type,
      )
      expect(views.subject).not.toHaveBeenCalled()
      expect(views.profile).not.toHaveBeenCalled()
      expect(views.item.mock.calls).toEqual(
        (collection === share ? input : [input[0], input[2]]).map((item) => [
          item,
        ]),
      )
      expectConserved(result, input)
    },
  )

  it('attaches before subject and actor grouping with collection and profile order determined by first appearance', () => {
    const article = activity('article', 90 * 24 * HOUR)
    const target = article.item.record.uri
    const otherTarget = activity('missing', HOUR).item.record.uri
    const input = [
      activity('share1', 0, share, { target, author: 'carol' }),
      activity('rec1', MINUTE, recommend, { target, author: 'bob' }),
      activity('share2', 2 * MINUTE, share, { target, author: 'alice' }),
      activity('rec2', 3 * MINUTE, recommend, { target, author: 'bob' }),
      activity('other', 4 * MINUTE, recommend, { target: otherTarget }),
      activity('rec3', 5 * MINUTE, recommend, { target, author: 'alice' }),
      article,
    ]
    const views = hydration()
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual([
      [input[4].item.record.uri],
      [article.item.record.uri],
    ])
    expect(result[1]).toMatchObject({
      $type: timeline.activityItem.$type,
      relatedActivity: [
        {
          collection: share,
          activities: [
            { record: input[0].item.record },
            { record: input[2].item.record },
          ],
          actors: [{ did: 'did:plc:carol' }, { did: 'did:plc:alice' }],
        },
        {
          collection: recommend,
          activities: [
            { record: input[1].item.record },
            { record: input[3].item.record },
            { record: input[5].item.record },
          ],
          actors: [{ did: 'did:plc:bob' }, { did: 'did:plc:alice' }],
        },
      ],
    })
    expect(views.item.mock.calls).toEqual([[article], [input[4]]])
    expect(views.subject).not.toHaveBeenCalled()
    expect(views.profile.mock.calls).toEqual([
      ['did:plc:carol'],
      ['did:plc:alice'],
      ['did:plc:bob'],
      ['did:plc:alice'],
    ])
    expectConserved(result, input)
  })

  it('keeps attachments on every document rather than hiding nonfirst documents in an actor group', () => {
    const article1 = activity('article1', 10 * MINUTE)
    const article2 = activity('article2', 20 * MINUTE)
    const input = [
      activity('rec1', 0, recommend, { target: article2.item.record.uri }),
      activity('rec2', MINUTE, recommend, { target: article1.item.record.uri }),
      article1,
      article2,
    ]
    const views = hydration()
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual([
      [article1.item.record.uri],
      [article2.item.record.uri],
    ])
    expect(result).toMatchObject([
      {
        $type: timeline.activityItem.$type,
        relatedActivity: [{ activities: [{ record: input[1].item.record }] }],
      },
      {
        $type: timeline.activityItem.$type,
        relatedActivity: [{ activities: [{ record: input[0].item.record }] }],
      },
    ])
    expect(views.item).toHaveBeenCalledTimes(2)
    expect(views.subject).not.toHaveBeenCalled()
    expectConserved(result, input)
  })

  it('retains all related actions without a five-item cap', () => {
    const article = activity('article', HOUR)
    const input = [
      ...Array.from({ length: 12 }, (_, index) =>
        activity(`rec${index}`, index * MINUTE, recommend, {
          target: article.item.record.uri,
        }),
      ),
      article,
    ]
    const views = hydration()
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual([[article.item.record.uri]])
    if (!('record' in result[0])) throw new Error('Expected article item')
    expect(result[0].relatedActivity?.[0].activities).toHaveLength(12)
    expect(views.item.mock.calls).toEqual([[article]])
    expect(views.profile.mock.calls).toEqual([['did:plc:alice']])
    expectConserved(result, input)
  })

  it('preserves action fallbacks when an article cannot be presented', () => {
    const article = activity('article', 5 * MINUTE)
    const input = [
      activity('rec', 0, recommend, { target: article.item.record.uri }),
      activity('share', MINUTE, share, { target: article.item.record.uri }),
      article,
    ]
    const views = hydration()
    const presentItem = views.item.getMockImplementation()!
    views.item.mockImplementation((value) =>
      value === article ? undefined : presentItem(value),
    )
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual([
      [input[0].item.record.uri],
      [input[1].item.record.uri],
    ])
    expect(views.item.mock.calls).toEqual([[article], [input[0]], [input[1]]])
    expectConserved(result, input.slice(0, 2))
  })

  it('does not emit a subject group with fewer than two available actor profiles', () => {
    const target = activity('missing', HOUR).item.record.uri
    const input = [
      activity('rec1', 0, recommend, { target }),
      activity('rec2', MINUTE, recommend, { target, author: 'bob' }),
    ]
    const views = hydration()
    const profile = views.profile.getMockImplementation()!
    views.profile.mockImplementation((did) =>
      did === 'did:plc:bob' ? undefined : profile(did),
    )
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual(input.map(({ item }) => [item.record.uri]))
    expect(result.every(timeline.activityItem.$isTypeOf)).toBe(true)
    expect(views.subject).not.toHaveBeenCalled()
    expectConserved(result, input)
  })

  it('preserves actions when shared subject presentation is unavailable', () => {
    const target = activity('missing', HOUR).item.record.uri
    const input = [
      activity('rec1', 0, recommend, { target }),
      activity('rec2', MINUTE, recommend, { target, author: 'bob' }),
    ]
    const views = hydration()
    views.subject.mockReturnValue(undefined)
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual(input.map(({ item }) => [item.record.uri]))
    expectConserved(result, input)
  })

  it.each([subscription, favorite] as const)(
    'does not use an actor outside the newest-item window to qualify a %s subject group',
    (collection) => {
      const target = activity('missing', HOUR).item.record.uri
      const input = [
        activity('one', 0, collection, { target }),
        activity('two', MINUTE, collection, { target }),
        activity('outside', 30 * MINUTE + 1, collection, {
          target,
          author: 'bob',
        }),
      ]
      const views = hydration()
      const result = groupAtmosphereActivities(input, now, views)
      expect(rootUris(result)).toEqual([
        [input[0].item.record.uri, input[1].item.record.uri],
        [input[2].item.record.uri],
      ])
      expect(result[0].$type).toBe(timeline.activityActorGroup.$type)
      expect(views.subject).not.toHaveBeenCalled()
      expect(views.profile).not.toHaveBeenCalled()
      expectConserved(result, input)
    },
  )

  it('preserves standalone articles and actions rather than fabricating missing related actor profiles', () => {
    const article1 = activity('article1', 5 * MINUTE)
    const article2 = activity('article2', 10 * MINUTE)
    const input = [
      activity('rec', 0, recommend, { target: article2.item.record.uri }),
      article1,
      article2,
    ]
    const views = hydration()
    views.profile.mockReturnValue(undefined)
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual(input.map(({ item }) => [item.record.uri]))
    expect(result.every(timeline.activityItem.$isTypeOf)).toBe(true)
    for (const item of result)
      expect(item).not.toHaveProperty('relatedActivity')
    expect(views.subject).not.toHaveBeenCalled()
    expectConserved(result, input)
  })

  it.each(['subject', 'related'] as const)(
    'preserves record and actor completeness when a %s bucket has an unavailable profile',
    (kind) => {
      const article = activity('article', 4 * MINUTE)
      const target = article.item.record.uri
      const recommendations = ['alice', 'bob', 'carol'].map((author, index) =>
        activity(`rec${index}`, index * MINUTE, recommend, { target, author }),
      )
      const shared = activity('share', 3 * MINUTE, share, {
        target,
        author: 'dave',
      })
      const input =
        kind === 'related'
          ? [...recommendations, shared, article]
          : recommendations
      const views = hydration()
      views.profile.mockImplementation((did) =>
        did === 'did:plc:carol'
          ? undefined
          : app.bsky.actor.defs.profileViewBasic.$build({
              did,
              handle: asStringFormat('actor.test', 'handle'),
            }),
      )

      const result = groupAtmosphereActivities(input, now, views)
      const standalone =
        kind === 'related' ? [...recommendations, article] : recommendations
      expect(rootUris(result)).toEqual(
        standalone.map(({ item }) => [item.record.uri]),
      )
      expect(result.every(timeline.activityItem.$isTypeOf)).toBe(true)
      if (kind === 'related') {
        expect(result.at(-1)).toMatchObject({
          record: { uri: target },
          relatedActivity: [
            {
              collection: share,
              activities: [{ record: { uri: shared.item.record.uri } }],
              actors: [{ did: 'did:plc:dave' }],
            },
          ],
        })
      }
      expectConserved(result, input)
    },
  )

  it('selects the newest share when only shares can supply the pinned target', () => {
    const target = activity('missing', HOUR).item.record.uri
    const input = [
      activity('share1', 0, share, { target }),
      activity('share2', HOUR, share, { target, author: 'bob' }),
    ]
    const views = hydration()
    const result = groupAtmosphereActivities(input, now, views)
    expect(views.subject.mock.calls).toEqual([[input[0]]])
    expect(result[0]).toMatchObject({
      subject: {
        uri: target,
        bskyPostRef: {
          uri: input[0].item.record.uri,
          cid: input[0].item.record.cid,
        },
      },
    })
  })

  it.each([
    ['subject', favorite],
    ['subject', subscription],
    ['actor', gallery],
  ] as const)(
    'uses a fixed window anchored at the newest group item rather than chaining for %s groups of %s',
    (groupBy, collection) => {
      const target = activity('target', HOUR, gallery).item.record.uri
      const options = groupBy === 'subject' ? { target } : {}
      const otherOptions =
        groupBy === 'subject' ? { target, author: 'bob' } : {}
      const input = [
        activity('one', 0, collection, options),
        activity('two', 20 * MINUTE, collection, otherOptions),
        activity('three', 40 * MINUTE, collection, options),
        activity('four', 55 * MINUTE, collection, otherOptions),
      ]
      const result = groupAtmosphereActivities(input, now, hydration())
      expect(rootUris(result)).toEqual([
        input.slice(0, 2).map(({ item }) => item.record.uri),
        input.slice(2).map(({ item }) => item.record.uri),
      ])
      expect(result).toMatchObject([
        {
          $type:
            groupBy === 'subject'
              ? timeline.activitySubjectGroup.$type
              : timeline.activityActorGroup.$type,
        },
        {
          $type:
            groupBy === 'subject'
              ? timeline.activitySubjectGroup.$type
              : timeline.activityActorGroup.$type,
        },
      ])
      expectConserved(result, input)
    },
  )

  it.each(['subject', 'actor'] as const)(
    'includes exact window boundaries for %s groups',
    (groupBy) => {
      const target = activity('target', HOUR, gallery).item.record.uri
      const collection = groupBy === 'subject' ? favorite : gallery
      const options = groupBy === 'subject' ? { target } : {}
      const otherOptions =
        groupBy === 'subject' ? { target, author: 'bob' } : {}
      for (const age of [
        0,
        HOUR,
        12 * HOUR,
        12 * HOUR + 1,
        24 * HOUR,
        24 * HOUR + 1,
      ]) {
        const span = atmosphereWindow(age)
        const input = [
          activity('anchor', age, collection, options),
          activity('boundary', age + span, collection, otherOptions),
          activity('outside', age + span + 1, collection, options),
        ]
        const result = groupAtmosphereActivities(input, now, hydration())
        expect(rootUris(result)).toEqual([
          input.slice(0, 2).map(({ item }) => item.record.uri),
          [input[2].item.record.uri],
        ])
        expectConserved(result, input)
      }
    },
  )

  it('excludes subscribed articles, shares, unfinished streams and ineligible actors from actor grouping', () => {
    const input = [
      activity('subscribed1', 0, document, { subscribed: true }),
      activity('subscribed2', MINUTE, document, { subscribed: true }),
      activity('unknown1', MINUTE, document, { groupable: false }),
      activity('unknown2', MINUTE, document, { groupable: false }),
      activity('share1', 2 * MINUTE, share),
      activity('share2', 3 * MINUTE, share),
      activity('stream1', 4 * MINUTE, livestream),
      activity('stream2', 5 * MINUTE, livestream),
      activity('ineligible1', 6 * MINUTE, gallery, { groupable: false }),
      activity('ineligible2', 7 * MINUTE, gallery, { groupable: false }),
    ]
    const views = hydration()
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual(input.map(({ item }) => [item.record.uri]))
    expect(views.item.mock.calls).toEqual(input.map((value) => [value]))
    expect(views.subject).not.toHaveBeenCalled()
    expect(views.profile).not.toHaveBeenCalled()
  })

  it('actor-groups matching actors and collections, hydrating only the newest item including ended streams', () => {
    const input = [
      activity('article1', 0),
      activity('gallery1', MINUTE, gallery),
      activity('bob', 2 * MINUTE, document, { author: 'bob' }),
      activity('stream1', 3 * MINUTE, livestream, { ended: true }),
      activity('article2', 4 * MINUTE),
      activity('gallery2', 5 * MINUTE, gallery),
      activity('stream2', 6 * MINUTE, livestream, { ended: true }),
    ]
    const views = hydration()
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual([
      [input[0].item.record.uri, input[4].item.record.uri],
      [input[1].item.record.uri, input[5].item.record.uri],
      [input[2].item.record.uri],
      [input[3].item.record.uri, input[6].item.record.uri],
    ])
    expect(result[0]).toMatchObject({
      $type: timeline.activityActorGroup.$type,
      id: `actor:${input[0].item.record.uri}`,
      actor: 'did:plc:alice',
      indexedAt: input[0].item.record.indexedAt,
      item: { record: input[0].item.record, view: { title: 'Timeline item' } },
    })
    expect(views.item.mock.calls.map(([value]) => value)).toEqual(
      expect.arrayContaining(input.slice(0, 4)),
    )
    expect(views.item).toHaveBeenCalledTimes(4)
    expect(views.subject).not.toHaveBeenCalled()
    expect(views.profile).not.toHaveBeenCalled()
    expectConserved(result, input)
  })

  it('prioritizes subjects, then actor-groups remaining targets, keeping nonarticle actions separate', () => {
    const target1 = activity('target1', HOUR, gallery).item.record.uri
    const target2 = activity('target2', HOUR, gallery).item.record.uri
    const target3 = activity('target3', HOUR, gallery).item.record.uri
    const input = [
      activity('same1', 0, favorite, { target: target1 }),
      activity('different1', MINUTE, favorite, { target: target2 }),
      activity('subscription1', 2 * MINUTE, subscription, { target: target1 }),
      activity('same2', 3 * MINUTE, favorite, {
        target: target1,
        author: 'bob',
      }),
      activity('different2', 4 * MINUTE, favorite, { target: target3 }),
      activity('subscription2', 5 * MINUTE, subscription, {
        target: target1,
        author: 'bob',
      }),
    ]
    const result = groupAtmosphereActivities(input, now, hydration())
    expect(result).toMatchObject([
      { $type: timeline.activitySubjectGroup.$type },
      { $type: timeline.activityActorGroup.$type, collection: favorite },
      { $type: timeline.activitySubjectGroup.$type },
    ])
    expect(rootUris(result)).toEqual([
      [input[0].item.record.uri, input[3].item.record.uri],
      [input[1].item.record.uri, input[4].item.record.uri],
      [input[2].item.record.uri, input[5].item.record.uri],
    ])
    expectConserved(result, input)
  })

  it('keeps an attached nonfirst article outside actor groups so its related activity remains visible', () => {
    const article1 = activity('article1', 5 * MINUTE)
    const article2 = activity('article2', 10 * MINUTE)
    const article3 = activity('article3', 15 * MINUTE)
    const reaction = activity('reaction', 0, recommend, {
      target: article2.item.record.uri,
    })
    const input = [reaction, article1, article2, article3]
    const views = hydration()
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual([
      [article1.item.record.uri, article3.item.record.uri],
      [article2.item.record.uri],
    ])
    expect(result).toMatchObject([
      { $type: timeline.activityActorGroup.$type },
      {
        $type: timeline.activityItem.$type,
        record: article2.item.record,
        relatedActivity: [
          {
            collection: recommend,
            activities: [{ record: reaction.item.record }],
          },
        ],
      },
    ])
    expect(views.item.mock.calls).toEqual([[article2], [article1]])
    expect(views.subject).not.toHaveBeenCalled()
    expectConserved(result, input)
  })

  it('retains all actor-group URIs without a five-item cap', () => {
    const input = Array.from({ length: 12 }, (_, index) =>
      activity(`article${index}`, index * MINUTE),
    )
    const views = hydration()
    const result = groupAtmosphereActivities(input, now, views)
    expect(rootUris(result)).toEqual([input.map(({ item }) => item.record.uri)])
    expect(views.item.mock.calls).toEqual([[input[0]]])
    expectConserved(result, input)
  })

  it('returns empty pages and hydrated singletons without subject or profile hydration', () => {
    const views = hydration()
    expect(groupAtmosphereActivities([], now, views)).toEqual([])
    const single = activity('one', 0)
    const result = groupAtmosphereActivities([single], now, views)
    expect(rootUris(result)).toEqual([[single.item.record.uri]])
    expect(views.item.mock.calls).toEqual([[single]])
    expect(views.subject).not.toHaveBeenCalled()
    expect(views.profile).not.toHaveBeenCalled()
    expect(single.item.view).toBeUndefined()
  })

  it('omits unavailable standalone hydration', () => {
    const views = hydration()
    views.item.mockReturnValue(undefined)
    expect(groupAtmosphereActivities([activity('one', 0)], now, views)).toEqual(
      [],
    )
  })
})

describe('article attachment ordering', () => {
  it('also attaches reactions older than creation without a time limit', () => {
    const article = activity('newer-article', 0)
    const unrelated = activity('unrelated', HOUR, gallery)
    const rec = activity('old-recommendation', 60 * 24 * HOUR, recommend, {
      target: article.item.record.uri,
    })
    const shared = activity('old-share', 90 * 24 * HOUR, share, {
      target: article.item.record.uri,
    })
    const input = [article, unrelated, rec, shared]
    const result = groupAtmosphereActivities(input, now, hydration())
    expect(rootUris(result)).toEqual([
      [article.item.record.uri],
      [unrelated.item.record.uri],
    ])
    expect(result[0]).toMatchObject({
      relatedActivity: [
        { collection: recommend, activities: [{ record: rec.item.record }] },
        { collection: share, activities: [{ record: shared.item.record }] },
      ],
    })
    expectConserved(result, input)
  })
})
