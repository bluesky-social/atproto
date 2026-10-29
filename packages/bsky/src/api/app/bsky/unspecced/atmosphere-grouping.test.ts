import { describe, expect, it } from 'vitest'
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

type FeedEntry =
  | app.bsky.unspecced.getAtmosphereTimeline.AtmosphereItem
  | app.bsky.unspecced.getAtmosphereTimeline.AtmosphereGroup

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
    active?: boolean
  } = {},
): TimelineActivity {
  const uri = asAtUriString(
    `at://did:plc:${options.author ?? 'alice'}/${collection}/${id}`,
  )
  const indexedAt = toDatetimeString(new Date(now - age))
  return {
    sortedAt: now - age,
    target: options.target,
    groupable: options.groupable ?? true,
    item: timeline.atmosphereItem.$build({
      record: {
        uri,
        cid: asStringFormat(
          'bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
          'cid',
        ),
        indexedAt,
      },
      collection,
      viewerState: { subscribed: options.subscribed ?? false },
      ...(collection === livestream
        ? {
            view: app.bsky.embed.external.viewLivestream.$build({
              uri,
              title: id,
              description: '',
              active: options.active ?? false,
              ...(options.ended ? { endedAt: indexedAt } : {}),
            }),
          }
        : {}),
    }),
  }
}

function rootUris(feed: FeedEntry[]): AtUriString[][] {
  return feed.map((entry) =>
    'items' in entry
      ? entry.items.map((item) => item.record.uri)
      : [entry.record.uri],
  )
}

function allUris(feed: FeedEntry[]): AtUriString[] {
  return feed.flatMap((entry) => {
    const items = 'items' in entry ? entry.items : [entry]
    return items.flatMap((item) => [
      item.record.uri,
      ...(item.relatedActivity ?? []).map((related) => related.record.uri),
    ])
  })
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
  it('attaches shares and recommendations without a time limit or moving the article', () => {
    const article = activity('article', 30 * 24 * HOUR)
    const rec = activity('rec', 0, recommend, {
      target: article.item.record.uri,
      groupable: false,
    })
    const shared = activity('share', HOUR, share, {
      target: article.item.record.uri,
      groupable: false,
    })
    const between = activity('between', 2 * HOUR, gallery)
    const input = [rec, shared, between, article]
    const result = groupAtmosphereActivities(input, now)
    expect(rootUris(result)).toEqual([
      [between.item.record.uri],
      [article.item.record.uri],
    ])
    expect(result[1]).toEqual({
      ...article.item,
      relatedActivity: [rec.item, shared.item],
    })
    expect(article.item.relatedActivity).toBeUndefined()
    expect(allUris(result).sort()).toEqual(
      input.map(({ item }) => item.record.uri).sort(),
    )
    expect(allUris(groupAtmosphereActivities(input, now))).toHaveLength(4)
  })

  it('groups a shared target by action, keeping shares and recommendations separate', () => {
    const target = activity('missing', HOUR).item.record.uri
    const rec1 = activity('rec1', 0, recommend, { target })
    const share1 = activity('share1', MINUTE, share, {
      target,
      groupable: false,
    })
    const rec2 = activity('rec2', 2 * MINUTE, recommend, {
      target,
      author: 'bob',
    })
    const share2 = activity('share2', 3 * MINUTE, share, {
      target,
      author: 'carol',
      groupable: false,
    })
    const input = [rec1, share1, rec2, share2]
    const result = groupAtmosphereActivities(input, now)
    expect(rootUris(result)).toEqual([
      [rec1.item.record.uri, rec2.item.record.uri],
      [share1.item.record.uri, share2.item.record.uri],
    ])
    expect(result).toMatchObject([
      { groupBy: 'subject', collection: recommend, subject: target },
      { groupBy: 'subject', collection: share, subject: target },
    ])
  })

  it.each(['subject', 'actor'] as const)(
    'uses a fixed newest-member window rather than chaining for %s groups',
    (groupBy) => {
      const target = activity('target', HOUR).item.record.uri
      const options = groupBy === 'subject' ? { target } : {}
      const collection = groupBy === 'subject' ? recommend : gallery
      const input = [
        activity('one', 0, collection, options),
        activity('two', 20 * MINUTE, collection, options),
        activity('three', 40 * MINUTE, collection, options),
        activity('four', 55 * MINUTE, collection, options),
      ]
      const result = groupAtmosphereActivities(input, now)
      expect(rootUris(result)).toEqual([
        input.slice(0, 2).map(({ item }) => item.record.uri),
        input.slice(2).map(({ item }) => item.record.uri),
      ])
      expect(result).toMatchObject([{ groupBy }, { groupBy }])
    },
  )

  it.each([0, HOUR, 12 * HOUR, 12 * HOUR + 1, 24 * HOUR, 24 * HOUR + 1])(
    'includes the exact grouping span at anchor age %i, but not one millisecond beyond',
    (age) => {
      const span = atmosphereWindow(age)
      const input = [
        activity('anchor', age, gallery),
        activity('boundary', age + span, gallery),
        activity('outside', age + span + 1, gallery),
      ]
      expect(rootUris(groupAtmosphereActivities(input, now))).toEqual([
        input.slice(0, 2).map(({ item }) => item.record.uri),
        [input[2].item.record.uri],
      ])
    },
  )

  it('excludes subscribed articles, shares, unfinished streams and ineligible actors from author grouping', () => {
    const input = [
      activity('subscribed1', 0, document, { subscribed: true }),
      activity('subscribed2', MINUTE, document, { subscribed: true }),
      activity('share1', 2 * MINUTE, share),
      activity('share2', 3 * MINUTE, share),
      activity('stream1', 4 * MINUTE, livestream, { active: true }),
      activity('stream2', 5 * MINUTE, livestream, { active: false }),
      activity('ineligible1', 6 * MINUTE, gallery, { groupable: false }),
      activity('ineligible2', 7 * MINUTE, gallery, { groupable: false }),
    ]
    expect(groupAtmosphereActivities(input, now)).toEqual(
      input.map(({ item }) => item),
    )
  })

  it('author-groups only matching authors and kinds, including ended streams', () => {
    const input = [
      activity('article1', 0),
      activity('gallery1', MINUTE, gallery),
      activity('bob', 2 * MINUTE, document, { author: 'bob' }),
      activity('stream1', 3 * MINUTE, livestream, { ended: true }),
      activity('article2', 4 * MINUTE),
      activity('gallery2', 5 * MINUTE, gallery),
      activity('stream2', 6 * MINUTE, livestream, { ended: true }),
    ]
    const result = groupAtmosphereActivities(input, now)
    expect(rootUris(result)).toEqual([
      [input[0].item.record.uri, input[4].item.record.uri],
      [input[1].item.record.uri, input[5].item.record.uri],
      [input[2].item.record.uri],
      [input[3].item.record.uri, input[6].item.record.uri],
    ])
    expect(result[0]).toMatchObject({
      groupBy: 'actor',
      actor: 'did:plc:alice',
      indexedAt: input[0].item.record.indexedAt,
    })
    expect(allUris(result).sort()).toEqual(
      input.map(({ item }) => item.record.uri).sort(),
    )
  })

  it('prioritizes subject grouping, then author-groups remaining different targets exactly once', () => {
    const target1 = activity('target1', HOUR).item.record.uri
    const target2 = activity('target2', HOUR).item.record.uri
    const target3 = activity('target3', HOUR).item.record.uri
    const input = [
      activity('same1', 0, favorite, { target: target1 }),
      activity('different1', MINUTE, favorite, { target: target2 }),
      activity('subscription1', 2 * MINUTE, subscription, { target: target1 }),
      activity('same2', 3 * MINUTE, favorite, { target: target1 }),
      activity('different2', 4 * MINUTE, favorite, { target: target3 }),
      activity('subscription2', 5 * MINUTE, subscription, { target: target1 }),
    ]
    const result = groupAtmosphereActivities(input, now)
    expect(result).toMatchObject([
      { groupBy: 'subject', collection: favorite },
      { groupBy: 'actor', collection: favorite },
      { groupBy: 'subject', collection: subscription },
    ])
    expect(rootUris(result)).toEqual([
      [input[0].item.record.uri, input[3].item.record.uri],
      [input[1].item.record.uri, input[4].item.record.uri],
      [input[2].item.record.uri, input[5].item.record.uri],
    ])
    expect(allUris(result).sort()).toEqual(
      input.map(({ item }) => item.record.uri).sort(),
    )
    expect(new Set(allUris(result)).size).toBe(input.length)
  })

  it('keeps attached reactions on articles when their authors subsequently group', () => {
    const article1 = activity('article1', 5 * MINUTE)
    const article2 = activity('article2', 10 * MINUTE)
    const reaction = activity('reaction', 0, recommend, {
      target: article2.item.record.uri,
    })
    const result = groupAtmosphereActivities(
      [reaction, article1, article2],
      now,
    )
    expect(rootUris(result)).toEqual([
      [article1.item.record.uri, article2.item.record.uri],
    ])
    expect(result[0]).toMatchObject({
      items: [
        article1.item,
        { ...article2.item, relatedActivity: [reaction.item] },
      ],
    })
    expect(allUris(result)).toHaveLength(3)
  })

  it('returns empty pages and singletons without creating groups', () => {
    expect(groupAtmosphereActivities([], now)).toEqual([])
    const single = activity('one', 0)
    expect(groupAtmosphereActivities([single], now)).toEqual([single.item])
  })
})

describe('article attachment ordering', () => {
  it('also attaches reactions older than their article without a time limit', () => {
    const article = activity('newer-article', 0)
    const unrelated = activity('unrelated', HOUR, gallery)
    const rec = activity('old-recommendation', 60 * 24 * HOUR, recommend, {
      target: article.item.record.uri,
    })
    const shared = activity('old-share', 90 * 24 * HOUR, share, {
      target: article.item.record.uri,
    })
    const result = groupAtmosphereActivities(
      [article, unrelated, rec, shared],
      now,
    )
    expect(result).toEqual([
      { ...article.item, relatedActivity: [rec.item, shared.item] },
      unrelated.item,
    ])
    expect(allUris(result)).toHaveLength(4)
  })
})
