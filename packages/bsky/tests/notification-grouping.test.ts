import { createHash } from 'node:crypto'
import { Timestamp } from '@bufbuild/protobuf'
import { afterAll, assert, beforeAll, describe, expect, it, vi } from 'vitest'
import { DAY } from '@atproto/common'
import { type SeedClient, TestNetwork, usersSeed } from '@atproto/dev-env'
import {
  type AtUriString,
  type DatetimeString,
  type DidString,
  asStringFormat,
  toDatetimeString,
} from '@atproto/lex'
import {
  APPVIEW_NOTIFICATION_REASON,
  type DataplaneNotificationReason,
  NOTIFICATION_REASON,
} from '../src/api/app/bsky/notification/constants.js'
import { getNextRawLimit } from '../src/api/app/bsky/notification/getGroupedNotifications.js'
import {
  type NotificationGroup,
  type NotificationItem,
  buildGroups,
  parseRawNotification,
} from '../src/api/app/bsky/notification/grouping/grouping.js'
import { buildSpotlight } from '../src/api/app/bsky/notification/grouping/spotlight.js'
import type { HydrationState } from '../src/hydration/hydrator.js'
import { HydrationMap } from '../src/hydration/util.js'
import { app } from '../src/lexicons/index.js'
import {
  GetNotificationsV2Response,
  Notification,
  NotificationFeed,
} from '../src/proto/bsky_pb.js'

const NOW = '2026-09-21T12:00:00.000Z'
const now = Date.parse(NOW)
const post = (name: string) =>
  `at://did:plc:viewer/${app.bsky.feed.post.$type}/${name}` as AtUriString
const minutesAgo = (minutes: number) =>
  new Date(now - minutes * 60_000).toISOString()

const item = (
  id: string,
  indexedAt: string,
  kind: DataplaneNotificationReason = NOTIFICATION_REASON.LIKE,
  {
    actor = id,
    subject = post('main'),
  }: { actor?: string; subject?: AtUriString } = {},
): NotificationItem => {
  const actorDid = `did:plc:${actor}` as DidString
  const collection =
    kind === NOTIFICATION_REASON.LIKE ||
    kind === NOTIFICATION_REASON.LIKE_VIA_REPOST
      ? app.bsky.feed.like.$type
      : kind === NOTIFICATION_REASON.FOLLOW ||
          kind === NOTIFICATION_REASON.FOLLOW_BACK
        ? app.bsky.graph.follow.$type
        : kind === NOTIFICATION_REASON.REPOST ||
            kind === NOTIFICATION_REASON.REPOST_VIA_REPOST
          ? app.bsky.feed.repost.$type
          : app.bsky.feed.post.$type
  const reasonSubjectRequired =
    kind === NOTIFICATION_REASON.LIKE ||
    kind === NOTIFICATION_REASON.REPOST ||
    kind === NOTIFICATION_REASON.LIKE_VIA_REPOST ||
    kind === NOTIFICATION_REASON.REPOST_VIA_REPOST ||
    kind === NOTIFICATION_REASON.REPLY ||
    kind === NOTIFICATION_REASON.QUOTE ||
    kind === NOTIFICATION_REASON.STARTERPACK_JOINED
  const raw = parseRawNotification(
    new Notification({
      recipientDid: 'did:plc:viewer',
      uri: `at://${actorDid}/${collection}/${id}`,
      reason: kind,
      ...(reasonSubjectRequired ? { reasonSubject: subject } : {}),
      timestamp: Timestamp.fromJson(indexedAt),
    }),
  )
  if (!raw) throw new Error('Invalid notification fixture')
  const groupingKey =
    kind === NOTIFICATION_REASON.FOLLOW
      ? kind
      : kind === NOTIFICATION_REASON.SUBSCRIBED_POST
        ? actorDid
        : (raw.reasonSubject ?? raw.uri)
  return {
    raw,
    id,
    groupingKey,
    actorDid,
  }
}

describe('notification grouping', () => {
  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s groups interleaved likes by post and orders the groups by their newest like',
    (algorithm) => {
      const poem = post('poem')
      const song = post('song')
      const items = [
        item('alice-poem', minutesAgo(0), NOTIFICATION_REASON.LIKE, {
          actor: 'alice',
          subject: poem,
        }),
        item('bob-song', minutesAgo(1), NOTIFICATION_REASON.LIKE, {
          actor: 'bob',
          subject: song,
        }),
        item('carol-poem', minutesAgo(2), NOTIFICATION_REASON.LIKE, {
          actor: 'carol',
          subject: poem,
        }),
        item('dan-song', minutesAgo(3), NOTIFICATION_REASON.LIKE, {
          actor: 'dan',
          subject: song,
        }),
      ]

      const result = buildGroups(items, 2, now, undefined, algorithm)

      expect(
        result.groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([
        ['alice-poem', 'carol-poem'],
        ['bob-song', 'dan-song'],
      ])
      expect(result.groups.map(({ groupingKey }) => groupingKey)).toEqual([
        poem,
        song,
      ])
      expect(result.cursor).toBeUndefined()
    },
  )

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s keeps filling existing groups after reaching the page limit, then leaves the first new group for the next page',
    (algorithm) => {
      const poem = post('poem')
      const song = post('song')
      const photo = post('photo')
      const items = [
        item('poem-1', minutesAgo(0), NOTIFICATION_REASON.LIKE, {
          subject: poem,
        }),
        item('song-1', minutesAgo(1), NOTIFICATION_REASON.LIKE, {
          subject: song,
        }),
        item('poem-2', minutesAgo(2), NOTIFICATION_REASON.LIKE, {
          subject: poem,
        }),
        item('song-2', minutesAgo(3), NOTIFICATION_REASON.LIKE, {
          subject: song,
        }),
        item('photo-1', minutesAgo(4), NOTIFICATION_REASON.LIKE, {
          subject: photo,
        }),
        item('poem-3', minutesAgo(5), NOTIFICATION_REASON.LIKE, {
          subject: poem,
        }),
      ]

      const firstPage = buildGroups(items, 2, now, undefined, algorithm)

      expect(
        firstPage.groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([
        ['poem-1', 'poem-2'],
        ['song-1', 'song-2'],
      ])
      expect(firstPage.cursor).toBe(items[3]!.raw.indexedAt)

      const secondPage = buildGroups(
        items.slice(4),
        2,
        now,
        undefined,
        algorithm,
      )
      expect(
        secondPage.groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([['photo-1'], ['poem-3']])
      expect(secondPage.cursor).toBeUndefined()
    },
  )

  it('Gravity keeps the older group open after a weak connection splits off newer likes', () => {
    const items = [
      item('newer-1', minutesAgo(0)),
      item('newer-2', minutesAgo(1)),
      item('older-1', minutesAgo(60)),
      item('older-2', minutesAgo(61)),
    ]

    const result = buildGroups(items, 2, now, undefined, 'algoGravity')

    expect(result.groups.map(({ items }) => items.map(({ id }) => id))).toEqual(
      [
        ['newer-1', 'newer-2'],
        ['older-1', 'older-2'],
      ],
    )
  })

  it('Gravity uses the older group’s zone after a split, allowing likes 35 minutes apart to stay together', () => {
    const items = [
      item('newest', minutesAgo(0)),
      item('hour-old', minutesAgo(60)),
      item('older-like', minutesAgo(95)),
    ]

    const result = buildGroups(items, 2, now, undefined, 'algoGravity')

    expect(result.groups.map(({ items }) => items.map(({ id }) => id))).toEqual(
      [['newest'], ['hour-old', 'older-like']],
    )
  })

  it('Gravity stops before a like that would split a group beyond the page limit', () => {
    const items = [
      item('newer-1', minutesAgo(0)),
      item('newer-2', minutesAgo(1)),
      item('older', minutesAgo(60)),
    ]

    const result = buildGroups(items, 1, now, undefined, 'algoGravity')

    expect(result.groups[0]?.items.map(({ id }) => id)).toEqual([
      'newer-1',
      'newer-2',
    ])
    expect(result.cursor).toBe(items[1]!.raw.indexedAt)
  })

  it('Gravity splits equally weak connections at the middle-most one', () => {
    const gapMs = 27 * 60_000 + 40_000
    const items = Array.from({ length: 5 }, (_, index) =>
      item(`like-${index}`, new Date(now - index * gapMs).toISOString()),
    )

    const result = buildGroups(items, 2, now, undefined, 'algoGravity')

    expect(result.groups.map(({ items }) => items.map(({ id }) => id))).toEqual(
      [
        ['like-0', 'like-1'],
        ['like-2', 'like-3', 'like-4'],
      ],
    )
  })

  it('Lookback groups likes exactly at its 30-minute boundary; Gravity splits them', () => {
    const items = [item('newest', minutesAgo(1)), item('older', minutesAgo(31))]

    expect(
      buildGroups(items, 2, now, undefined, 'algoLookback').groups.map(
        ({ itemCount }) => itemCount,
      ),
    ).toEqual([2])
    expect(
      buildGroups(items, 2, now, undefined, 'algoGravity').groups.map(
        ({ itemCount }) => itemCount,
      ),
    ).toEqual([1, 1])
  })

  it('Lookback expands its grouping window when the newest like becomes one hour old', () => {
    const justUnderAnHour = [
      item('newer', '2026-09-21T11:00:00.001Z'),
      item('older', '2026-09-21T10:15:00.001Z'),
    ]
    const exactlyAnHour = [
      item('newer', '2026-09-21T11:00:00.000Z'),
      item('older', '2026-09-21T10:15:00.000Z'),
    ]

    expect(
      buildGroups(
        justUnderAnHour,
        2,
        now,
        undefined,
        'algoLookback',
      ).groups.map(({ items }) => items.map(({ id }) => id)),
    ).toEqual([['newer'], ['older']])
    expect(
      buildGroups(exactlyAnHour, 2, now, undefined, 'algoLookback').groups.map(
        ({ items }) => items.map(({ id }) => id),
      ),
    ).toEqual([['newer', 'older']])
  })

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s starts a new group at the 200-like cap without losing the next like',
    (algorithm) => {
      const start = Date.parse(minutesAgo(1))
      const items = Array.from({ length: 201 }, (_, index) =>
        item(`like-${index}`, new Date(start - index).toISOString()),
      )

      const firstPage = buildGroups(items, 1, now, undefined, algorithm)
      expect(firstPage.groups[0]?.items.map(({ id }) => id)).toEqual(
        items.slice(0, 200).map(({ id }) => id),
      )
      expect(firstPage.cursor).toBe(items[199]!.raw.indexedAt)

      const secondPage = buildGroups(
        items.slice(200),
        1,
        now,
        undefined,
        algorithm,
      )
      expect(secondPage.groups[0]?.items.map(({ id }) => id)).toEqual([
        'like-200',
      ])
    },
  )

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s groups recent likes across midnight',
    (algorithm) => {
      const now = Date.parse('2026-09-21T00:05:00.000Z')
      const items = [
        item('today', '2026-09-21T00:04:00.000Z'),
        item('yesterday', '2026-09-20T23:59:00.000Z'),
      ]

      expect(
        buildGroups(items, 2, now, undefined, algorithm).groups.map(
          ({ items }) => items.map(({ id }) => id),
        ),
      ).toEqual([['today', 'yesterday']])
    },
  )

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s groups older likes across days',
    (algorithm) => {
      const items = [
        item('today', '2026-09-21T11:00:00.000Z'),
        item('yesterday', '2026-09-20T00:30:00.000Z'),
        item('older', '2026-09-19T23:30:00.000Z'),
      ]

      expect(
        buildGroups(items, 3, now, undefined, algorithm).groups.map(
          ({ items }) => items.map(({ id }) => id),
        ),
      ).toEqual([['today'], ['yesterday', 'older']])
    },
  )

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s groups nearby likes on either side of 24 hours old',
    (algorithm) => {
      const items = [
        item('recent', '2026-09-20T12:00:00.001Z'),
        item('day-old', '2026-09-20T12:00:00.000Z'),
        item('older', '2026-09-20T11:59:59.999Z'),
        item('oldest', '2026-09-20T11:59:59.998Z'),
      ]

      const result = buildGroups(items, 1, now, undefined, algorithm)
      expect(
        result.groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([['recent', 'day-old', 'older', 'oldest']])
      expect(result.cursor).toBeUndefined()
    },
  )

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s shows followers separately in the followers feed but groups them in all',
    (algorithm) => {
      const items = [
        item('alice-follow', minutesAgo(0), NOTIFICATION_REASON.FOLLOW, {
          actor: 'alice',
        }),
        item('bob-follow', minutesAgo(1), NOTIFICATION_REASON.FOLLOW, {
          actor: 'bob',
        }),
      ]

      expect(
        buildGroups(items, 2, now, undefined, algorithm).groups.map(
          ({ items }) => items.map(({ id }) => id),
        ),
      ).toEqual([['alice-follow', 'bob-follow']])
      expect(
        buildGroups(
          items,
          2,
          now,
          undefined,
          algorithm,
          NotificationFeed.FOLLOWERS,
        ).groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([['alice-follow'], ['bob-follow']])
    },
  )

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s shows subscribed posts separately in activity but groups posts by the same actor in all',
    (algorithm) => {
      const items = [
        item(
          'alice-post-1',
          minutesAgo(0),
          NOTIFICATION_REASON.SUBSCRIBED_POST,
          {
            actor: 'alice',
          },
        ),
        item(
          'alice-post-2',
          minutesAgo(1),
          NOTIFICATION_REASON.SUBSCRIBED_POST,
          {
            actor: 'alice',
          },
        ),
      ]

      expect(
        buildGroups(items, 2, now, undefined, algorithm).groups.map(
          ({ items }) => items.map(({ id }) => id),
        ),
      ).toEqual([['alice-post-1', 'alice-post-2']])
      expect(
        buildGroups(
          items,
          2,
          now,
          undefined,
          algorithm,
          NotificationFeed.ACTIVITY,
        ).groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([['alice-post-1'], ['alice-post-2']])
    },
  )

  it('marks only items strictly older than the seen timestamp as read', () => {
    const items = [
      item('newest', minutesAgo(0), NOTIFICATION_REASON.MENTION),
      item('older', minutesAgo(60), NOTIFICATION_REASON.REPLY),
    ]
    const result = buildGroups(items, 2, now, now, 'algoGravity')

    expect(result.groups.map(({ isRead }) => isRead)).toEqual([false, true])
  })
})

const postLikes = (pairs: [actor: string, subject: string][]) =>
  pairs.map(([actor, subject], index) =>
    item(
      `${actor}-${subject}`,
      toDatetimeString(new Date(now - index)),
      NOTIFICATION_REASON.LIKE,
      { actor, subject: post(subject) },
    ),
  )

const spotlightTypes = [
  {
    reason: NOTIFICATION_REASON.LIKE,
    kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
    collection: app.bsky.feed.post.$type,
  },
  {
    reason: NOTIFICATION_REASON.REPOST,
    kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_REPOST,
    collection: app.bsky.feed.post.$type,
  },
  {
    reason: NOTIFICATION_REASON.LIKE_VIA_REPOST,
    kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE_VIA_REPOST,
    collection: app.bsky.feed.repost.$type,
  },
  {
    reason: NOTIFICATION_REASON.REPOST_VIA_REPOST,
    kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_REPOST_VIA_REPOST,
    collection: app.bsky.feed.repost.$type,
  },
] as const

const spotlightItems = (
  type: (typeof spotlightTypes)[number],
  count: number,
  { actor = 'alice', offset = 0 } = {},
) =>
  Array.from({ length: count }, (_, index) =>
    item(
      `${type.reason}-${actor}-${index}`,
      minutesAgo(offset + index / 1000),
      type.reason,
      {
        actor,
        subject: `at://did:plc:viewer/${type.collection}/post-${index}`,
      },
    ),
  )

const expectPage = (
  page: ReturnType<typeof buildSpotlight>,
  items: NotificationItem[],
  expectedGroups: string[][],
  cursor?: string,
) => {
  const ids = page.groups.flatMap((group) => group.items.map(({ id }) => id))
  expect(page.groups.map((group) => group.items.map(({ id }) => id))).toEqual(
    expectedGroups,
  )
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids.toSorted()).toEqual(
    items
      .slice(0, ids.length)
      .map(({ id }) => id)
      .sort(),
  )
  expect(page.cursor).toBe(cursor)
}

describe.each(['algoGravity', 'algoLookback'] as const)(
  '%s spotlight',
  (algorithm) => {
    const buildPage = (
      items: NotificationItem[],
      limit: number,
      { cursor, seenAt }: { cursor?: string; seenAt?: number } = {},
    ) => {
      const ordinary = buildGroups(items, limit, now, seenAt, algorithm)
      if (cursor !== undefined) ordinary.cursor = cursor
      const originals = structuredClone({ items, ordinary })
      const page = buildSpotlight(
        items,
        ordinary.groups,
        ordinary.cursor,
        limit,
        seenAt,
      )
      expect({ items, ordinary }).toEqual(originals)
      expect(page.groups.length).toBeLessThanOrEqual(limit)
      return { ordinary, page }
    }

    it('leaves an empty page untouched', () => {
      const { ordinary, page } = buildPage([], 1)
      expect(page.groups).toBe(ordinary.groups)
      expectPage(page, [], [])
    })

    describe.each(spotlightTypes)('$reason', (type) => {
      it('spotlights only the top actor and leaves other actors in ordinary groups', () => {
        const alice = spotlightItems(type, 4)
        const bob = spotlightItems(type, 4, { actor: 'bob', offset: 1 })
        const items = [...alice, ...bob]
        const { page } = buildPage(items, 5)

        expectPage(page, items, [
          alice.map(({ id }) => id),
          ...bob.map(({ id }) => [id]),
        ])
        expect(page.groups.map(({ kind }) => kind)).toEqual([
          type.kind,
          ...Array(4).fill(type.reason),
        ])
      })

      it.each([
        { count: 200, matches: 4, eligible: true },
        { count: 201, matches: 7, eligible: false },
        { count: 201, matches: 8, eligible: true },
        { count: 500, matches: 8, eligible: true },
        { count: 501, matches: 8, eligible: false },
      ])(
        'uses page-volume thresholds: $count items, $matches matching, eligible=$eligible',
        ({ count, matches, eligible }) => {
          const matching = spotlightItems(type, matches)
          const items = [
            ...matching,
            ...Array.from({ length: count - matches }, (_, index) =>
              item(
                `follow-${index}`,
                minutesAgo(1 + index / 1000),
                NOTIFICATION_REASON.FOLLOW,
              ),
            ),
          ]
          const { page } = buildPage(items, 30)
          expect(page.groups.some(({ kind }) => kind === type.kind)).toBe(
            eligible,
          )
        },
      )

      it('trims across groups without losing notifications on the next page', () => {
        const alice = spotlightItems(type, 4)
        const bob = spotlightItems(type, 4, { actor: 'bob' })
        const items = alice.flatMap((notification, index) => [
          notification,
          bob[index]!,
        ])
        items.forEach((notification, index) => {
          notification.raw.indexedAt = toDatetimeString(new Date(now - index))
        })
        const { page } = buildPage(items, 4)
        expectPage(
          page,
          items,
          [alice.map(({ id }) => id), ...bob.slice(0, 3).map(({ id }) => [id])],
          items[6]!.raw.indexedAt,
        )
        expect(page.groups[0]?.kind).toBe(type.kind)
        const { page: next } = buildPage(items.slice(7), 4)
        expectPage(next, items.slice(7), [[bob[3]!.id]])
      })

      it('leaves items beyond the spotlight size cap in ordinary groups', () => {
        const items = spotlightItems(type, 201)
        const { page } = buildPage(items, 201)
        expectPage(page, items, [
          items.slice(0, 200).map(({ id }) => id),
          [items[200]!.id],
        ])
        expect(
          page.groups.map(({ kind, itemCount }) => [kind, itemCount]),
        ).toEqual([
          [type.kind, 200],
          [type.reason, 1],
        ])
      })
    })

    it.each([false, true])(
      'caps spotlights at three types, ranking by count then recency (tied=%s)',
      (tied) => {
        const batches = spotlightTypes.map((type, index) =>
          spotlightItems(type, tied ? 4 : index + 4, { offset: index }),
        )
        const items = batches.flat()
        const { page } = buildPage(items, 30)
        const omitted = tied ? 3 : 0
        expectPage(
          page,
          items,
          batches.flatMap((batch, index) =>
            index === omitted
              ? batch.map(({ id }) => [id])
              : [batch.map(({ id }) => id)],
          ),
        )
        expect(
          page.groups
            .filter(({ kind }) =>
              spotlightTypes.some((type) => type.kind === kind),
            )
            .map(({ kind }) => kind),
        ).toEqual(
          spotlightTypes
            .filter((_, index) => index !== omitted)
            .map(({ kind }) => kind),
        )
      },
    )

    it('does not combine different reasons to reach eligibility', () => {
      const items = spotlightTypes.flatMap((type, index) =>
        spotlightItems(type, 3, { offset: index }),
      )
      const { ordinary, page } = buildPage(items, 30)
      expect(page.groups).toBe(ordinary.groups)
    })

    it('uses the fourth eligible type when trimming rejects a higher-ranked spotlight', () => {
      const top = spotlightTypes.map((type, index) =>
        spotlightItems(type, index === 0 ? 5 : 4),
      )
      const others = spotlightTypes.map((type, index) =>
        spotlightItems(type, index === 0 ? 5 : 4, { actor: 'bob' }),
      )
      const likes = top[0]!
      const otherLikes = others[0]!
      const items = [
        ...likes.slice(0, 3),
        ...top.slice(1).flat(),
        ...others.flat(),
        ...likes.slice(3),
      ]
      items.forEach((notification, index) => {
        notification.raw.indexedAt = toDatetimeString(new Date(now - index))
      })
      const { page } = buildPage(items, 17)
      expect(
        page.groups
          .filter(({ kind }) => kind.startsWith('multi-post-'))
          .map(({ kind }) => kind),
      ).toEqual(spotlightTypes.slice(1).map(({ kind }) => kind))
      expectPage(
        page,
        items,
        [
          ...likes
            .slice(0, 3)
            .map(({ id }, index) => [id, otherLikes[index]!.id]),
          ...top.slice(1).map((batch) => batch.map(({ id }) => id)),
          ...otherLikes.slice(3).map(({ id }) => [id]),
          ...others[1]!.slice(0, 3).map(({ id }) => [id]),
        ],
        others[1]![2]!.raw.indexedAt,
      )
      const remaining = items.slice(items.indexOf(others[1]![2]!) + 1)
      const { page: nextPage } = buildPage(remaining, 17)
      expectPage(nextPage, remaining, [
        [others[1]![3]!.id],
        ...others.slice(2).map((batch) => batch.map(({ id }) => id)),
        ...likes.slice(3).map(({ id }) => [id]),
      ])
    })

    it('keeps valid spotlights when trimming disqualifies another type', () => {
      const likes = spotlightItems(spotlightTypes[0], 4)
      const reposts = spotlightItems(spotlightTypes[1], 4, { offset: 1 })
      const others = spotlightItems(spotlightTypes[1], 4, {
        actor: 'bob',
        offset: 2,
      })
      const otherLikes = spotlightItems(spotlightTypes[0], 4, {
        actor: 'carol',
        offset: 3,
      })
      const items = [
        ...likes,
        ...otherLikes.slice(0, 3),
        ...reposts.slice(0, 3),
        ...others,
        reposts[3]!,
        otherLikes[3]!,
      ]
      items.forEach((notification, index) => {
        notification.raw.indexedAt = toDatetimeString(new Date(now - index))
      })
      const { page } = buildPage(items, 8)
      expect(
        page.groups
          .filter(({ kind }) => kind.startsWith('multi-post-'))
          .map(({ kind }) => kind),
      ).toEqual([APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE])
      expectPage(
        page,
        items,
        [
          likes.map(({ id }) => id),
          ...otherLikes.slice(0, 3).map(({ id }) => [id]),
          ...reposts
            .slice(0, 3)
            .map(({ id }, index) => [id, others[index]!.id]),
          [others[3]!.id, reposts[3]!.id],
        ],
        reposts[3]!.raw.indexedAt,
      )
    })

    it.each([
      { invalidated: 'earlier', tryFourth: false },
      { invalidated: 'new', tryFourth: false },
      { invalidated: 'earlier', tryFourth: true },
      { invalidated: 'new', tryFourth: true },
    ] as const)(
      'preserves accepted spotlights when a third invalidates the $invalidated spotlight (fourth=$tryFourth)',
      ({ invalidated, tryFourth }) => {
        const likes = spotlightItems(spotlightTypes[0], 6)
        const reposts = spotlightItems(spotlightTypes[1], 5)
        const viaRepost = spotlightItems(spotlightTypes[2], 4)
        const fourth = tryFourth ? spotlightItems(spotlightTypes[3], 4) : []
        const otherItems = (batch: NotificationItem[]) =>
          batch.map(({ raw }, index) =>
            item(`other-${raw.reason}-${index}`, NOW, raw.reason, {
              actor: `other-${index}`,
              subject: raw.reasonSubject,
            }),
          )
        const otherLikes = otherItems(likes)
        const otherReposts = otherItems(reposts)
        const otherViaRepost = otherItems(viaRepost)
        const invalidatesEarlier = invalidated === 'earlier'
        const fourthItem = invalidatesEarlier ? likes[3]! : viaRepost[3]!
        const items = [
          ...(invalidatesEarlier ? likes.slice(0, 3) : likes),
          ...reposts,
          ...(invalidatesEarlier ? viaRepost : viaRepost.slice(0, 3)),
          ...fourth,
          ...otherViaRepost,
          ...otherReposts,
          ...otherLikes.slice(0, 4),
          fourthItem,
          ...otherLikes.slice(4),
          ...(invalidatesEarlier ? likes.slice(4) : []),
        ]
        items.forEach((notification, index) => {
          notification.raw.indexedAt = toDatetimeString(new Date(now - index))
        })
        // @NOTE Each of the first three spotlight attempts forces one more ordinary group off the page.
        // The third attempt trims away the fourth item of either itself or the accepted like spotlight.
        const { page } = buildPage(items, tryFourth ? 19 : 15, { seenAt: now })

        expectPage(
          page,
          items,
          [
            (invalidatesEarlier ? likes.slice(0, 4) : likes).map(
              ({ id }) => id,
            ),
            reposts.map(({ id }) => id),
            ...(invalidatesEarlier ? viaRepost : viaRepost.slice(0, 3)).map(
              ({ id }, index) => [id, otherViaRepost[index]!.id],
            ),
            ...(tryFourth ? [fourth.map(({ id }) => id)] : []),
            ...(!invalidatesEarlier
              ? [[otherViaRepost[3]!.id, viaRepost[3]!.id]]
              : []),
            ...otherReposts.map(({ id }) => [id]),
            ...otherLikes.slice(0, 4).map(({ id }) => [id]),
          ],
          fourthItem.raw.indexedAt,
        )
        expect(
          page.groups
            .filter(({ kind }) => kind.startsWith('multi-post-'))
            .map(({ kind, itemCount, isRead }) => ({
              kind,
              itemCount,
              isRead,
            })),
        ).toEqual([
          {
            kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
            itemCount: invalidatesEarlier ? 4 : 6,
            isRead: false,
          },
          {
            kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_REPOST,
            itemCount: 5,
            isRead: true,
          },
          ...(tryFourth
            ? [
                {
                  kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_REPOST_VIA_REPOST,
                  itemCount: 4,
                  isRead: true,
                },
              ]
            : []),
        ])

        const remaining = items.slice(items.indexOf(fourthItem) + 1)
        const { page: nextPage } = buildPage(remaining, 15)
        expectPage(nextPage, remaining, [
          [otherLikes[4]!.id, ...(invalidatesEarlier ? [likes[4]!.id] : [])],
          [otherLikes[5]!.id, ...(invalidatesEarlier ? [likes[5]!.id] : [])],
        ])
      },
    )

    it('combines recent and older likes into one spotlight across days', () => {
      const items = Array.from({ length: 4 }, (_, index) =>
        item(
          `like-${index}`,
          minutesAgo(index < 2 ? index : 24 * 60 + index),
          NOTIFICATION_REASON.LIKE,
          { actor: 'alice', subject: post(`post-${index}`) },
        ),
      )
      const { page } = buildPage(items, items.length)

      expectPage(page, items, [['like-0', 'like-1', 'like-2', 'like-3']])
      expect(page.groups[0]?.kind).toBe(
        APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
      )
    })

    it('fits without trimming and updates ordinary and spotlight metadata', () => {
      const items = postLikes([
        ['alice', 'poem'],
        ['bob', 'poem'],
        ['alice', 'song'],
        ['carol', 'song'],
        ['alice', 'photo'],
        ['dan', 'photo'],
        ['alice', 'story'],
        ['eve', 'story'],
      ])
      const { page } = buildPage(items, 5, { seenAt: now })

      expectPage(page, items, [
        ['alice-poem', 'alice-song', 'alice-photo', 'alice-story'],
        ['bob-poem'],
        ['carol-song'],
        ['dan-photo'],
        ['eve-story'],
      ])
      expect(page.groups.map(({ kind }) => kind)).toEqual([
        APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
        'like',
        'like',
        'like',
        'like',
      ])
      expect(page.groups[0]).toEqual({
        id: 'alice-poem',
        kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
        groupingKey: 'did:plc:alice',
        items: [items[0], items[2], items[4], items[6]],
        actorDids: Array(4).fill('did:plc:alice'),
        itemCount: 4,
        indexedAt: items[0]!.raw.indexedAt,
        firstIndexedAt: items[6]!.raw.indexedAt,
        isRead: false,
      })
      expect(
        page.groups.slice(1).map((group) => ({
          id: group.id,
          actorDids: group.actorDids,
          count: group.itemCount,
          indexedAt: group.indexedAt,
          firstIndexedAt: group.firstIndexedAt,
          isRead: group.isRead,
        })),
      ).toEqual(
        [1, 3, 5, 7].map((index) => ({
          id: items[index]!.id,
          actorDids: [items[index]!.actorDid],
          count: 1,
          indexedAt: items[index]!.raw.indexedAt,
          firstIndexedAt: items[index]!.raw.indexedAt,
          isRead: true,
        })),
      )
    })

    it('discards emptied ordinary groups and preserves the ordinary cursor', () => {
      const items = postLikes([
        ['alice', 'poem'],
        ['alice', 'song'],
        ['alice', 'photo'],
        ['alice', 'story'],
      ])
      const cursor = minutesAgo(1)
      const { page } = buildPage(items, 4, { cursor })

      expectPage(
        page,
        items,
        [['alice-poem', 'alice-song', 'alice-photo', 'alice-story']],
        cursor,
      )
      expect(page.groups[0]?.kind).toBe(
        APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
      )
    })

    it('trims a continuous prefix across interleaved groups and resumes without gaps', () => {
      const items = postLikes([
        ['alice', 'poem'],
        ['bob', 'poem'],
        ['alice', 'song'],
        ['carol', 'song'],
        ['alice', 'photo'],
        ['dan', 'photo'],
        ['alice', 'story'],
        ['eve', 'story'],
        ['frank', 'poem'],
        ['grace', 'song'],
        ['han', 'photo'],
        ['ivy', 'story'],
      ])
      const { page } = buildPage(items, 4)

      expectPage(
        page,
        items,
        [
          ['alice-poem', 'alice-song', 'alice-photo', 'alice-story'],
          ['bob-poem'],
          ['carol-song'],
          ['dan-photo'],
        ],
        items[6]!.raw.indexedAt,
      )

      const remaining = items.filter(
        (item) => Date.parse(item.raw.indexedAt) < Date.parse(page.cursor!),
      )
      const { page: nextPage } = buildPage(remaining, 4)
      expectPage(nextPage, remaining, [
        ['eve-story', 'ivy-story'],
        ['frank-poem'],
        ['grace-song'],
        ['han-photo'],
      ])
      const returned = [...page.groups, ...nextPage.groups].flatMap((group) =>
        group.items.map(({ id }) => id),
      )
      expect(returned.toSorted()).toEqual(items.map(({ id }) => id).sort())
    })

    it('falls back when trimming removes the fourth qualifying like', () => {
      const items = postLikes([
        ['alice', 'poem'],
        ['bob', 'poem'],
        ['alice', 'song'],
        ['carol', 'song'],
        ['alice', 'photo'],
        ['dan', 'photo'],
        ['eve', 'story'],
        ['alice', 'story'],
      ])
      const cursor = minutesAgo(1)
      const { ordinary, page } = buildPage(items, 4, { cursor })

      expect(page.groups).toBe(ordinary.groups)
      expectPage(
        page,
        items,
        [
          ['alice-poem', 'bob-poem'],
          ['alice-song', 'carol-song'],
          ['alice-photo', 'dan-photo'],
          ['eve-story', 'alice-story'],
        ],
        cursor,
      )
    })

    it('falls back when the entire spotlight would be the extra group', () => {
      const items = postLikes([
        ['bob', 'poem'],
        ['carol', 'song'],
        ['dan', 'photo'],
        ['eve', 'story'],
        ['alice', 'poem'],
        ['alice', 'song'],
        ['alice', 'photo'],
        ['alice', 'story'],
      ])
      const { ordinary, page } = buildPage(items, 4)

      expect(page.groups).toBe(ordinary.groups)
      expectPage(page, items, [
        ['bob-poem', 'alice-poem'],
        ['carol-song', 'alice-song'],
        ['dan-photo', 'alice-photo'],
        ['eve-story', 'alice-story'],
      ])
    })

    it('falls back without trying the new top liker after trimming', () => {
      const items = postLikes([
        ['alice', 'poem'],
        ['bob', 'poem'],
        ['bob', 'song'],
        ['alice', 'song'],
        ['bob', 'photo'],
        ['alice', 'photo'],
        ['bob', 'story'],
        ['alice', 'story'],
        ['bob', 'drawing'],
        ['carol', 'video'],
        ['alice', 'drawing'],
        ['alice', 'video'],
      ])
      const cursor = minutesAgo(1)
      const { ordinary, page } = buildPage(items, 6, { cursor })

      expect(page.groups).toBe(ordinary.groups)
      expectPage(
        page,
        items,
        [
          ['alice-poem', 'bob-poem'],
          ['bob-song', 'alice-song'],
          ['bob-photo', 'alice-photo'],
          ['bob-story', 'alice-story'],
          ['bob-drawing', 'alice-drawing'],
          ['carol-video', 'alice-video'],
        ],
        cursor,
      )
    })

    it('breaks tied top counts by the newest like, choosing only one actor', () => {
      const items = postLikes([
        ['bob', 'poem'],
        ['alice', 'song'],
        ['alice', 'poem'],
        ['alice', 'photo'],
        ['alice', 'story'],
        ['bob', 'song'],
        ['bob', 'photo'],
        ['bob', 'story'],
      ])
      const { page } = buildPage(items, 5)

      expectPage(page, items, [
        ['bob-poem', 'bob-song', 'bob-photo', 'bob-story'],
        ['alice-song'],
        ['alice-poem'],
        ['alice-photo'],
        ['alice-story'],
      ])
      expect(
        page.groups
          .filter(
            (group) =>
              group.kind === APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
          )
          .map((group) => group.groupingKey),
      ).toEqual(['did:plc:bob'])
    })

    it('falls back if trimming creates a tie won by another actor’s newer like', () => {
      const items = postLikes([
        ['bob', 'poem'],
        ['alice', 'poem'],
        ['bob', 'song'],
        ['alice', 'song'],
        ['bob', 'photo'],
        ['alice', 'photo'],
        ['bob', 'story'],
        ['alice', 'story'],
        ['carol', 'video'],
        ['alice', 'video'],
      ])
      const { ordinary, page } = buildPage(items, 5)

      expect(page.groups).toBe(ordinary.groups)
      expectPage(page, items, [
        ['bob-poem', 'alice-poem'],
        ['bob-song', 'alice-song'],
        ['bob-photo', 'alice-photo'],
        ['bob-story', 'alice-story'],
        ['carol-video', 'alice-video'],
      ])
    })

    it.each([
      { count: 200, likes: 3, eligible: false },
      { count: 200, likes: 4, eligible: true },
      { count: 201, likes: 4, eligible: false },
      { count: 201, likes: 7, eligible: false },
      { count: 201, likes: 8, eligible: true },
      { count: 500, likes: 7, eligible: false },
      { count: 500, likes: 8, eligible: true },
      { count: 501, likes: 8, eligible: false },
    ])(
      '$count notifications and $likes distinct posts: eligible=$eligible',
      ({ count, likes, eligible }) => {
        const subjects = Array.from(
          { length: likes },
          (_, index) => `post-${index}`,
        )
        const items = postLikes([
          ...subjects.map((subject): [string, string] => ['alice', subject]),
          ...Array.from(
            { length: count - likes },
            (_, index): [string, string] => [
              `other-${index}`,
              subjects[index % likes]!,
            ],
          ),
        ])
        const { ordinary, page } = buildPage(items, likes + 1)
        const expectedGroups = subjects.map((subject, postIndex) => [
          ...(!eligible ? [`alice-${subject}`] : []),
          ...Array.from({ length: count - likes }, (_, index) => index)
            .filter((index) => index % likes === postIndex)
            .map((index) => `other-${index}-${subject}`),
        ])
        if (eligible)
          expectedGroups.unshift(subjects.map((subject) => `alice-${subject}`))

        expectPage(page, items, expectedGroups)
        if (eligible)
          expect(page.groups[0]?.kind).toBe(
            APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
          )
        else expect(page.groups).toBe(ordinary.groups)
      },
    )

    it('keeps eight qualifying posts when a 201-notification page trims to 200', () => {
      const subjects = Array.from({ length: 8 }, (_, index) => `post-${index}`)
      const items = postLikes([
        ...subjects.map((subject): [string, string] => ['alice', subject]),
        ...Array.from({ length: 192 }, (_, index): [string, string] => [
          `other-${index}`,
          subjects[index % 7]!,
        ]),
        ['bob', 'post-7'],
      ])
      const { page } = buildPage(items, 8)

      expectPage(
        page,
        items,
        [
          subjects.map((subject) => `alice-${subject}`),
          ...subjects.slice(0, 7).map((subject, postIndex) =>
            Array.from({ length: 192 }, (_, index) => index)
              .filter((index) => index % 7 === postIndex)
              .map((index) => `other-${index}-${subject}`),
          ),
        ],
        items[199]!.raw.indexedAt,
      )
      expect(page.groups[0]?.itemCount).toBe(8)
      expect(page.groups[0]?.kind).toBe(
        APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
      )
    })

    it('does not lower the eight-post threshold after trimming below 201 notifications', () => {
      const subjects = Array.from({ length: 8 }, (_, index) => `post-${index}`)
      const items = postLikes([
        ...subjects
          .slice(0, 7)
          .map((subject): [string, string] => ['alice', subject]),
        ...Array.from({ length: 192 }, (_, index): [string, string] => [
          `other-${index}`,
          subjects[index % 7]!,
        ]),
        ['bob', 'post-7'],
        ['alice', 'post-7'],
      ])
      const { ordinary, page } = buildPage(items, 8)

      expect(page.groups).toBe(ordinary.groups)
      expectPage(page, items, [
        ...subjects.slice(0, 7).map((subject, postIndex) => [
          `alice-${subject}`,
          ...Array.from({ length: 192 }, (_, index) => index)
            .filter((index) => index % 7 === postIndex)
            .map((index) => `other-${index}-${subject}`),
        ]),
        ['bob-post-7', 'alice-post-7'],
      ])
    })

    it('ignores fetched notifications outside the ordinary page for volume and top actor', () => {
      const items = postLikes([
        ['alice', 'poem'],
        ['alice', 'song'],
        ['alice', 'photo'],
        ['alice', 'story'],
        ...Array.from({ length: 600 }, (_, index): [string, string] => [
          'bob',
          `older-${index}`,
        ]),
      ])
      const { page } = buildPage(items, 4)

      expectPage(
        page,
        items,
        [['alice-poem', 'alice-song', 'alice-photo', 'alice-story']],
        items[3]!.raw.indexedAt,
      )
      expect(page.groups[0]?.kind).toBe(
        APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
      )
    })

    it('includes non-like notifications in the page-volume threshold', () => {
      const items = [
        ...postLikes([
          ['alice', 'poem'],
          ['alice', 'song'],
          ['alice', 'photo'],
          ['alice', 'story'],
        ]),
        ...Array.from({ length: 197 }, (_, index) =>
          item(
            `follow-${index}`,
            minutesAgo(1 + index / 1000),
            NOTIFICATION_REASON.FOLLOW,
          ),
        ),
      ]
      const { ordinary, page } = buildPage(items, 5)

      expect(page.groups).toBe(ordinary.groups)
      expectPage(page, items, [
        ['alice-poem'],
        ['alice-song'],
        ['alice-photo'],
        ['alice-story'],
        Array.from({ length: 197 }, (_, index) => `follow-${index}`),
      ])
    })

    it.each([NOTIFICATION_REASON.LIKE, NOTIFICATION_REASON.LIKE_VIA_REPOST])(
      'does not count generator likes or %s notifications toward a post-like spotlight',
      (reason) => {
        const items = [
          ...postLikes([
            ['alice', 'poem'],
            ['alice', 'song'],
            ['alice', 'photo'],
          ]),
          item('non-post', minutesAgo(1), reason, {
            actor: 'alice',
            subject: `at://did:plc:viewer/${
              reason === NOTIFICATION_REASON.LIKE
                ? app.bsky.feed.generator.$type
                : app.bsky.feed.repost.$type
            }/subject`,
          }),
        ]
        const { ordinary, page } = buildPage(items, 4)

        expect(page.groups).toBe(ordinary.groups)
        expectPage(page, items, [
          ['alice-poem'],
          ['alice-song'],
          ['alice-photo'],
          ['non-post'],
        ])
      },
    )

    it('keeps likes beyond the 200-item spotlight cap in ordinary groups', () => {
      const items = postLikes(
        Array.from({ length: 201 }, (_, index) => ['alice', `post-${index}`]),
      )
      const { page } = buildPage(items, 201)

      expectPage(page, items, [
        Array.from({ length: 200 }, (_, index) => `alice-post-${index}`),
        ['alice-post-200'],
      ])
      expect(
        page.groups.map(({ kind, itemCount }) => [kind, itemCount]),
      ).toEqual([
        [APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE, 200],
        ['like', 1],
      ])
    })
  },
)

describe.each(['algoGravity', 'algoLookback'] as const)(
  '%s spotlight endpoint',
  (algorithm) => {
    let network: TestNetwork
    let sc: SeedClient
    let fixtureIndex = 0
    const defs = app.bsky.notification.getGroupedNotifications

    beforeAll(async () => {
      network = await TestNetwork.create({
        dbPostgresSchema: `bsky_spotlight_${algorithm.toLowerCase()}`,
        bsky: { notificationsV2Algorithm: algorithm },
      })
      sc = network.getSeedClient()
      await usersSeed(sc)
    })

    afterAll(async () => network?.close())

    const seedSpotlight = async (count = 4) => {
      const name = `spotlight-${fixtureIndex++}`
      const { did: recipient } = await sc.createAccount(name, {
        email: `${name}@test.com`,
        handle: `${name}.test`,
        password: 'spotlight-pass',
      })
      const records: {
        post: Awaited<ReturnType<SeedClient['post']>>
        like: AtUriString
        indexedAt: DatetimeString
        id: string
      }[] = []
      for (let index = 0; index < count; index++) {
        const post = await sc.post(recipient, `Post ${index}`)
        const like = (
          await sc.like(sc.dids.bob, post.ref)
        ).toString() as AtUriString
        const indexedAt = Timestamp.fromDate(
          new Date(now - index * 1000),
        ).toJson() as DatetimeString
        records.push({
          post,
          like,
          indexedAt,
          id: createHash('sha256')
            .update(`${indexedAt}\0${like}`)
            .digest('base64url'),
        })
      }
      await network.processAll()
      for (const { like, indexedAt } of records) {
        await network.bsky.db.db
          .updateTable('notification')
          .set({ sortAt: toDatetimeString(new Date(indexedAt)) })
          .where('recordUri', '=', like)
          .where('did', '=', recipient)
          .execute()
      }
      await network.bsky.ctx.dataplane.updateNotificationSeen({
        actorDid: recipient,
        timestamp: Timestamp.fromJson(records[1]!.indexedAt),
      })
      const headers = await network.serviceHeaders(recipient, defs.$lxm)
      return { recipient, records, headers }
    }

    describe.each(spotlightTypes.slice(1))(
      '$reason spotlight',
      ({ reason }) => {
        const via =
          reason === NOTIFICATION_REASON.LIKE_VIA_REPOST ||
          reason === NOTIFICATION_REASON.REPOST_VIA_REPOST
        it.each([
          { remaining: 12, removal: 'none' },
          { remaining: 3, removal: 'interaction' },
          { remaining: 2, removal: 'subject' },
          { remaining: 1, removal: 'post' },
          { remaining: 0, removal: 'block' },
        ] as const)(
          'renders $remaining surviving items after $removal filtering',
          async ({ remaining, removal }) => {
            const name = `rp-spotlight-${fixtureIndex++}`
            const { did: recipient } = await sc.createAccount(name, {
              email: `${name}@test.com`,
              handle: `${name}.test`,
              password: 'spotlight-pass',
            })
            const records: {
              post: AtUriString
              viaRepost?: AtUriString
              uri: AtUriString
              indexedAt: DatetimeString
              id: string
            }[] = []
            for (let index = 0; index < 12; index++) {
              const post = await sc.post(
                via ? sc.dids.carol : recipient,
                `Post ${index}`,
              )
              const repost = via
                ? await sc.repost(recipient, post.ref)
                : undefined
              const overrides = repost ? { via: repost.raw } : undefined
              const uri =
                reason === NOTIFICATION_REASON.LIKE_VIA_REPOST
                  ? ((
                      await sc.like(sc.dids.bob, post.ref, overrides)
                    ).toString() as AtUriString)
                  : (await sc.repost(sc.dids.bob, post.ref, overrides)).uriStr
              const indexedAt = Timestamp.fromDate(
                new Date(now - index * 1000),
              ).toJson() as DatetimeString
              records.push({
                post: post.ref.uriStr,
                ...(repost ? { viaRepost: repost.uriStr } : {}),
                uri,
                indexedAt,
                id: createHash('sha256')
                  .update(`${indexedAt}\0${uri}`)
                  .digest('base64url'),
              })
            }
            if (removal === 'block') await sc.block(recipient, sc.dids.bob)
            await network.processAll()
            for (const { uri, indexedAt } of records) {
              await network.bsky.db.db
                .updateTable('notification')
                .set({ sortAt: toDatetimeString(new Date(indexedAt)) })
                .where('recordUri', '=', uri)
                .where('did', '=', recipient)
                .execute()
            }
            if (removal !== 'block') {
              for (const record of records.slice(0, 12 - remaining)) {
                await network.bsky.ctx.dataplane.takedownRecord({
                  recordUri:
                    removal === 'interaction'
                      ? record.uri
                      : removal === 'subject'
                        ? (record.viaRepost ?? record.post)
                        : record.post,
                })
              }
            }
            await network.bsky.ctx.dataplane.updateNotificationSeen({
              actorDid: recipient,
              timestamp: Timestamp.fromJson(records[10]!.indexedAt),
            })
            const headers = await network.serviceHeaders(recipient, defs.$lxm)
            const response = await network.bsky
              .getClient()
              .call(defs, { limit: 30 }, { headers })
            const kept = records.slice(12 - remaining)
            const newest = kept[0]
            const viaRepostItems = via
              ? kept.map(({ post, viaRepost }) => {
                  assert(viaRepost)
                  return { post, viaRepost }
                })
              : []
            expect(response.groups).toEqual(
              newest
                ? [
                    defs.group.$build({
                      id: newest.id,
                      indexedAt: newest.indexedAt,
                      isRead: remaining === 1,
                      count: remaining,
                      kind:
                        remaining === 1
                          ? reason === NOTIFICATION_REASON.REPOST
                            ? defs.repostGroup.$build({
                                post: newest.post,
                                items: [{ actor: sc.dids.bob }],
                              })
                            : reason === NOTIFICATION_REASON.LIKE_VIA_REPOST
                              ? defs.likeViaRepostGroup.$build({
                                  post: newest.post,
                                  viaRepost: newest.viaRepost!,
                                  items: [{ actor: sc.dids.bob }],
                                })
                              : defs.repostViaRepostGroup.$build({
                                  post: newest.post,
                                  viaRepost: newest.viaRepost!,
                                  items: [{ actor: sc.dids.bob }],
                                })
                          : reason === NOTIFICATION_REASON.REPOST
                            ? defs.multiPostRepostGroup.$build({
                                actor: sc.dids.bob,
                                items: kept.map(({ post }) => ({ post })),
                              })
                            : reason === NOTIFICATION_REASON.LIKE_VIA_REPOST
                              ? defs.multiPostLikeViaRepostGroup.$build({
                                  actor: sc.dids.bob,
                                  items: viaRepostItems,
                                })
                              : defs.multiPostRepostViaRepostGroup.$build({
                                  actor: sc.dids.bob,
                                  items: viaRepostItems,
                                }),
                    }),
                  ]
                : [],
            )
            expect(response.relatedViews).toMatchObject([
              ...(remaining
                ? [
                    {
                      $type: app.bsky.actor.defs.profileViewDetailed.$type,
                      did: sc.dids.bob,
                    },
                  ]
                : []),
              ...kept.slice(0, 10).map(({ post }) => ({
                $type: app.bsky.feed.defs.postView.$type,
                uri: post,
              })),
            ])
            expect(response.cursor).toBeUndefined()
            expect(response.seenAt).toBe(records[10]!.indexedAt)
            for (const group of response.groups)
              expect(defs.group.$matches(group)).toBe(true)
          },
        )
      },
    )

    const cappedPost = post('capped')
    const cappedGenerator: AtUriString = `at://did:plc:viewer/${app.bsky.feed.generator.$type}/capped`
    const cappedRepost: AtUriString = `at://did:plc:viewer/${app.bsky.feed.repost.$type}/capped`
    const allActors = Array.from({ length: 8 }, (_, index) => ({
      actor: `did:plc:cap-actor-${index}` as DidString,
    }))

    it('returns basic related profiles with filtered known followers', async () => {
      const { recipient, headers } = await seedSpotlight()
      const { bob, carol, dan } = sc.dids
      await sc.follow(bob, recipient)
      await sc.follow(recipient, carol)
      await sc.follow(recipient, dan)
      await sc.follow(carol, bob)
      await sc.follow(dan, bob)
      await sc.block(bob, dan)
      await network.processAll()
      const client = network.bsky.getClient()
      const detailed = await client.call(
        app.bsky.actor.getProfile,
        { actor: bob },
        {
          headers: await network.serviceHeaders(
            recipient,
            app.bsky.actor.getProfile.$lxm,
          ),
        },
      )
      using aggregates = vi.spyOn(
        network.bsky.ctx.hydrator.dataplane,
        'getCountsForUsers',
      )

      const response = await client.call(defs, { limit: 4 }, { headers })

      const profile = response.relatedViews?.find(
        app.bsky.actor.defs.profileViewBasic.$isTypeOf,
      )
      assert(profile)
      expect(profile.did).toBe(bob)
      expect(profile.viewer).toEqual(detailed.viewer)
      expect(profile.viewer?.knownFollowers).toMatchObject({
        count: 2,
        followers: [{ did: carol }],
      })
      expect(profile.viewer?.knownFollowers?.followers).toHaveLength(1)
      expect(
        profile.viewer?.knownFollowers?.followers[0]?.viewer?.knownFollowers,
      ).toBeUndefined()
      expect(profile.labels).toEqual(detailed.labels)
      expect(profile.verification).toEqual(detailed.verification)
      expect(profile).not.toHaveProperty('description')
      expect(profile).not.toHaveProperty('followersCount')
      expect(aggregates).not.toHaveBeenCalled()
    })

    it.each(['all', 'followers'] as const)(
      'hydrates known followers for the first ten actors per follow group in the %s feed',
      async (feed) => {
        const { recipient, headers } = await seedSpotlight()
        const { carol, dan } = sc.dids
        await sc.follow(recipient, carol)
        await sc.follow(recipient, dan)
        await network.processAll()
        await sc.follow(carol, recipient)

        const followers: DidString[] = []
        const name = `social-proof-${fixtureIndex++}`
        for (let index = 0; index < 12; index++) {
          const handle = `${name}-${index}.test`
          const { did } = await sc.createAccount(`${name}-${index}`, {
            email: `${handle}@test.com`,
            handle,
            password: 'social-proof-pass',
          })
          followers.push(did)
          await sc.follow(did, recipient)
          await sc.follow(dan, did)
        }
        await network.processAll()
        using knownFollowers = vi.spyOn(
          network.bsky.ctx.hydrator.dataplane,
          'sampleFollowsFollowing',
        )

        const response = await network.bsky
          .getClient()
          .call(defs, { feed, limit: 30 }, { headers })

        const followGroups = response.groups
          .map(({ kind }) => kind)
          .filter(defs.followGroup.$isTypeOf)
        expect(followGroups.map(({ items }) => items.length)).toEqual(
          feed === 'all' ? [12] : Array(12).fill(1),
        )
        expect(
          response.groups.filter(({ kind }) =>
            defs.followBackNotification.$isTypeOf(kind),
          ),
        ).toHaveLength(1)
        const expectedDids = followers
          .slice()
          .reverse()
          .slice(0, feed === 'all' ? 10 : 12)
        expect(
          followGroups.flatMap(({ items }) =>
            items.slice(0, 10).map(({ actor }) => actor),
          ),
        ).toEqual(expectedDids)
        expect(
          knownFollowers.mock.calls.flatMap(([req]) => req.targetDids),
        ).toEqual(expectedDids)
        const profiles = response.relatedViews?.filter(
          app.bsky.actor.defs.profileViewBasic.$isTypeOf,
        )
        expect(
          profiles
            ?.filter((profile) => profile.viewer?.knownFollowers)
            .map(({ did }) => did),
        ).toEqual(expectedDids)
        for (const did of expectedDids) {
          expect(
            profiles?.find((profile) => profile.did === did)?.viewer
              ?.knownFollowers,
          ).toMatchObject({ count: 1, followers: [{ did: dan }] })
        }
      },
    )

    it.each([
      {
        name: 'like',
        kind: NOTIFICATION_REASON.LIKE,
        subject: cappedPost,
        expectedKind: defs.likeGroup.$build({
          post: cappedPost,
          items: allActors,
        }),
      },
      {
        name: 'repost',
        kind: NOTIFICATION_REASON.REPOST,
        subject: cappedPost,
        expectedKind: defs.repostGroup.$build({
          post: cappedPost,
          items: allActors,
        }),
      },
      {
        name: 'like via repost',
        kind: NOTIFICATION_REASON.LIKE_VIA_REPOST,
        subject: cappedRepost,
        expectedKind: defs.likeViaRepostGroup.$build({
          post: cappedPost,
          viaRepost: cappedRepost,
          items: allActors,
        }),
      },
      {
        name: 'repost via repost',
        kind: NOTIFICATION_REASON.REPOST_VIA_REPOST,
        subject: cappedRepost,
        expectedKind: defs.repostViaRepostGroup.$build({
          post: cappedPost,
          viaRepost: cappedRepost,
          items: allActors,
        }),
      },
      {
        name: 'follow',
        kind: NOTIFICATION_REASON.FOLLOW,
        subject: cappedPost,
        expectedKind: defs.followGroup.$build({ items: allActors }),
      },
      {
        name: 'subscribed post',
        kind: NOTIFICATION_REASON.SUBSCRIBED_POST,
        subject: cappedPost,
        expectedKind: defs.subscribedPostGroup.$build({
          items: Array.from({ length: 8 }, (_, index) => ({
            actor: 'did:plc:cap-actor-0',
            post: `at://did:plc:cap-actor-0/${app.bsky.feed.post.$type}/cap-${index}`,
          })),
        }),
      },
      {
        name: 'generator like',
        kind: NOTIFICATION_REASON.LIKE,
        subject: cappedGenerator,
        expectedKind: defs.generatorLikeGroup.$build({
          generator: cappedGenerator,
          items: allActors,
        }),
      },
      {
        name: 'multi-post like',
        kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
        subject: cappedPost,
        expectedKind: defs.multiPostLikeGroup.$build({
          actor: 'did:plc:cap-actor-0',
          items: Array.from({ length: 8 }, (_, index) => ({
            post: post(`cap-${index}`),
          })),
        }),
      },
    ])(
      'returns all items for $name while preserving the full count',
      ({ kind, subject, expectedKind }) => {
        const sameActor =
          kind === APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE ||
          kind === NOTIFICATION_REASON.SUBSCRIBED_POST
        const items = Array.from({ length: 8 }, (_, index) =>
          item(
            `cap-${index}`,
            minutesAgo(index),
            kind === APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE
              ? NOTIFICATION_REASON.LIKE
              : kind,
            {
              actor: `cap-actor-${sameActor ? 0 : index}`,
              subject:
                kind === APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE
                  ? post(`cap-${index}`)
                  : subject,
            },
          ),
        )
        const group: NotificationGroup = {
          id: items[0]!.id,
          kind,
          groupingKey: sameActor ? items[0]!.actorDid : items[0]!.groupingKey,
          actorDids: items.map((item) => item.actorDid),
          itemCount: 8,
          indexedAt: items[0]!.raw.indexedAt,
          firstIndexedAt: items[7]!.raw.indexedAt,
          isRead: false,
          items,
        }
        const original = structuredClone(group)
        const cid = asStringFormat(
          'bafyreidad6nyekfa4a67yfb573ptxiv6s7kyxyg2ra6qbbemcruadvtuim',
          'cid',
        )
        const state: HydrationState = {
          reposts: new HydrationMap([
            [
              cappedRepost,
              {
                record: app.bsky.feed.repost.$build({
                  subject: { uri: cappedPost, cid },
                  createdAt: items[0]!.raw.indexedAt,
                }),
                cid,
                indexedAt: new Date(NOW),
                sortedAt: new Date(NOW),
                takedownRef: undefined,
              },
            ],
          ]),
        }

        const view = network.bsky.ctx.views.notificationGroup(group, state)

        assert(view && 'items' in view.kind)
        expect(view.count).toBe(8)
        expect(view.kind.items).toHaveLength(8)
        expect(view).toEqual(
          defs.group.$build({
            id: 'cap-0',
            indexedAt: items[0]!.raw.indexedAt,
            isRead: false,
            count: 8,
            kind: expectedKind,
          }),
        )
        expect(group).toEqual(original)
      },
    )

    it('returns all twelve follows with related profiles for only the first ten', async () => {
      const follows: {
        actor: DidString
        uri: AtUriString
        indexedAt: DatetimeString
      }[] = []
      for (let index = 0; index < 12; index++) {
        const name = `cap-follower-${index}`
        const { did } = await sc.createAccount(name, {
          email: `${name}@test.com`,
          handle: `${name}.test`,
          password: 'cap-follower-pass',
        })
        const follow = await sc.follow(did, sc.dids.alice)
        follows.push({
          actor: did,
          uri: follow.uriStr,
          indexedAt: toDatetimeString(new Date(minutesAgo(index))),
        })
      }
      await network.processAll()
      for (const { uri, indexedAt } of follows) {
        await network.bsky.db.db
          .updateTable('notification')
          .set({ sortAt: indexedAt })
          .where('recordUri', '=', uri)
          .where('did', '=', sc.dids.alice)
          .execute()
      }
      const headers = await network.serviceHeaders(sc.dids.alice, defs.$lxm)

      const response = await network.bsky
        .getClient()
        .call(defs, { limit: 1 }, { headers })

      expect(response.groups).toHaveLength(1)
      const group = response.groups[0]!
      assert(defs.followGroup.$isTypeOf(group.kind))
      expect(group.count).toBe(12)
      expect(group.kind.items).toHaveLength(12)
      expect(group.kind.items).toEqual(follows.map(({ actor }) => ({ actor })))
      expect(response.relatedViews).toMatchObject(
        follows.slice(0, 10).map(({ actor }) => ({
          $type: app.bsky.actor.defs.profileViewBasic.$type,
          did: actor,
        })),
      )
      expect(response.cursor).toBeUndefined()
    })

    it.each([undefined, 0, 11])(
      'returns all spotlight items with ten related records when like %s is removed',
      async (removedIndex) => {
        const { records, headers } = await seedSpotlight(12)
        if (removedIndex !== undefined) {
          await network.bsky.ctx.dataplane.takedownRecord({
            recordUri: records[removedIndex]!.like,
          })
        }

        const response = await network.bsky
          .getClient()
          .call(defs, { limit: 12 }, { headers })

        expect(response.groups).toHaveLength(1)
        const group = response.groups[0]!
        assert(defs.multiPostLikeGroup.$isTypeOf(group.kind))
        const remaining = records.filter((_, index) => index !== removedIndex)
        expect(group.count).toBe(removedIndex === undefined ? 12 : 11)
        expect(group.kind.items).toHaveLength(
          removedIndex === undefined ? 12 : 11,
        )
        expect(group.kind.items).toEqual(
          remaining.map(({ post }) => ({ post: post.ref.uriStr })),
        )
        expect(group.id).toBe(remaining[0]!.id)
        expect(group.indexedAt).toBe(remaining[0]!.indexedAt)
        expect(response.relatedViews).toMatchObject([
          {
            $type: app.bsky.actor.defs.profileViewBasic.$type,
            did: sc.dids.bob,
          },
          ...remaining.slice(0, 10).map(({ post }) => ({
            $type: app.bsky.feed.defs.postView.$type,
            uri: post.ref.uriStr,
          })),
        ])
        expect(response.cursor).toBeUndefined()
      },
    )

    it('returns all subscribed posts with related views for only the first ten of each group', async () => {
      const authors = [sc.dids.bob, sc.dids.dan]
      const postGroups = await Promise.all(
        authors.map(async (actor) => {
          const posts: Awaited<ReturnType<SeedClient['post']>>[] = []
          for (let index = 0; index < 12; index++) {
            posts.push(await sc.post(actor, `Subscribed post ${index}`))
          }
          return { actor, posts }
        }),
      )
      await network.processAll()
      // The test dataplane doesn't generate subscribed-post notifications.
      using notifications = vi
        .spyOn(network.bsky.ctx.hydrator.dataplane, 'getNotificationsV2')
        .mockResolvedValue(
          new GetNotificationsV2Response({
            notifications: postGroups
              .flatMap(({ posts }) => posts)
              .map(
                ({ ref }, index) =>
                  new Notification({
                    recipientDid: sc.dids.carol,
                    uri: ref.uriStr,
                    reason: NOTIFICATION_REASON.SUBSCRIBED_POST,
                    timestamp: Timestamp.fromJson(minutesAgo(index)),
                  }),
              ),
          }),
        )
      const headers = await network.serviceHeaders(sc.dids.carol, defs.$lxm)

      const response = await network.bsky
        .getClient()
        .call(defs, { limit: 2 }, { headers })

      expect(notifications).toHaveBeenCalledTimes(1)
      expect(response.groups.map(({ count }) => count)).toEqual([12, 12])
      expect(response.groups.map(({ kind }) => kind)).toEqual(
        postGroups.map(({ actor, posts }) =>
          defs.subscribedPostGroup.$build({
            items: posts.map(({ ref }) => ({ actor, post: ref.uriStr })),
          }),
        ),
      )
      expect(response.relatedViews).toMatchObject([
        ...authors.map((did) => ({
          $type: app.bsky.actor.defs.profileViewBasic.$type,
          did,
        })),
        ...postGroups.flatMap(({ posts }) =>
          posts.slice(0, 10).map(({ ref }) => ({
            $type: app.bsky.feed.defs.postView.$type,
            uri: ref.uriStr,
          })),
        ),
      ])
      expect(response.cursor).toBeUndefined()
    })

    it.each([4, 3, 2, 1, 0])(
      'renders %i surviving likes with exact metadata and related views after rules filtering',
      async (remaining) => {
        const { records, headers } = await seedSpotlight()
        for (const { like } of records.slice(0, 4 - remaining)) {
          await network.bsky.ctx.dataplane.takedownRecord({ recordUri: like })
        }
        using reads = vi.spyOn(
          network.bsky.ctx.hydrator.dataplane,
          'getNotificationsV2',
        )
        using hydration = vi.spyOn(
          network.bsky.ctx.hydrator,
          'hydrateGroupedNotifications',
        )
        const response = await network.bsky
          .getClient()
          .call(defs, { limit: 4 }, { headers })
        const kept = records.slice(4 - remaining)
        const newest = kept[0]

        expect(reads).toHaveBeenCalledTimes(1)
        expect((await reads.mock.results[0]!.value).cursor).toBe('')
        expect(hydration).toHaveBeenCalledTimes(1)
        expect(hydration.mock.calls[0]![0].map(({ uri }) => uri)).toEqual(
          records.map(({ like }) => like),
        )
        expect(response.groups).toEqual(
          newest
            ? [
                defs.group.$build({
                  id: newest.id,
                  indexedAt: newest.indexedAt,
                  isRead: remaining < 3,
                  count: remaining,
                  kind:
                    remaining === 1
                      ? defs.likeGroup.$build({
                          post: newest.post.ref.uriStr,
                          items: [{ actor: sc.dids.bob }],
                        })
                      : defs.multiPostLikeGroup.$build({
                          actor: sc.dids.bob,
                          items: kept.map(({ post }) => ({
                            post: post.ref.uriStr,
                          })),
                        }),
                }),
              ]
            : [],
        )
        expect(response.seenAt).toBe(records[1]!.indexedAt)
        expect(response.cursor).toBeUndefined()
        expect(response.relatedViews).toMatchObject([
          ...(remaining
            ? [
                {
                  $type: app.bsky.actor.defs.profileViewBasic.$type,
                  did: sc.dids.bob,
                },
              ]
            : []),
          ...kept.map(({ post }) => ({
            $type: app.bsky.feed.defs.postView.$type,
            uri: post.ref.uriStr,
          })),
        ])
        for (const view of response.relatedViews ?? []) {
          expect(
            app.bsky.actor.defs.profileViewBasic.$matches(view) ||
              app.bsky.feed.defs.postView.$matches(view),
          ).toBe(true)
        }
      },
    )

    it('deduplicates profiles and records across mixed notification groups', async () => {
      const { recipient, records, headers } = await seedSpotlight(2)
      const generator = await sc.createFeedGen(
        recipient,
        'did:web:example.com',
        'Related feed',
      )
      const starterPack = await sc.createStarterPack(
        recipient,
        'Related starter pack',
        [recipient],
      )
      await sc.like(sc.dids.bob, generator)
      await sc.follow(sc.dids.bob, recipient, { via: starterPack.raw })
      await sc.follow(sc.dids.carol, recipient, { via: starterPack.raw })
      await network.processAll()

      const response = await network.bsky
        .getClient()
        .call(defs, { limit: 30 }, { headers })

      expect(response.groups).toHaveLength(4)
      const expectedViews = [
        ...[sc.dids.bob, sc.dids.carol].map((did) => ({
          $type: app.bsky.actor.defs.profileViewBasic.$type,
          did,
        })),
        ...records.map(({ post }) => ({
          $type: app.bsky.feed.defs.postView.$type,
          uri: post.ref.uriStr,
        })),
        {
          $type: app.bsky.feed.defs.generatorView.$type,
          uri: generator.uriStr,
        },
        {
          $type: app.bsky.graph.defs.starterPackViewBasic.$type,
          uri: starterPack.uriStr,
        },
      ]
      expect(response.relatedViews).toHaveLength(expectedViews.length)
      expect(response.relatedViews).toEqual(
        expect.arrayContaining(
          expectedViews.map((view) => expect.objectContaining(view)),
        ),
      )
    })

    it.each(['not found', 'blocked'] as const)(
      'includes a typed placeholder for a %s reply parent',
      async (status) => {
        const { recipient, records, headers } = await seedSpotlight(2)
        const root = records[0]!.post.ref
        const parent = await sc.reply(sc.dids.carol, root, root, 'Parent')
        const reply = await sc.reply(sc.dids.bob, root, parent.ref, 'Reply')
        if (status === 'blocked') {
          await sc.block(recipient, sc.dids.carol)
        }
        await network.processAll()
        if (status === 'not found') {
          await network.bsky.ctx.dataplane.takedownRecord({
            recordUri: parent.ref.uriStr,
          })
        }
        using notifications = vi
          .spyOn(network.bsky.ctx.hydrator.dataplane, 'getNotificationsV2')
          .mockResolvedValue(
            new GetNotificationsV2Response({
              notifications: [
                new Notification({
                  recipientDid: recipient,
                  uri: reply.ref.uriStr,
                  reason: NOTIFICATION_REASON.REPLY,
                  reasonSubject: parent.ref.uriStr,
                  timestamp: Timestamp.fromJson(NOW),
                }),
              ],
            }),
          )

        const response = await network.bsky
          .getClient()
          .call(defs, { limit: 1 }, { headers })

        expect(notifications).toHaveBeenCalledTimes(1)
        expect(response.groups.map(({ kind }) => kind)).toEqual([
          defs.replyNotification.$build({
            post: reply.ref.uriStr,
            parent: parent.ref.uriStr,
          }),
        ])
        expect(response.relatedViews).toMatchObject([
          { $type: app.bsky.feed.defs.postView.$type, uri: reply.ref.uriStr },
          status === 'not found'
            ? app.bsky.feed.defs.notFoundPost.$build({
                uri: parent.ref.uriStr,
                notFound: true,
              })
            : app.bsky.feed.defs.blockedPost.$build({
                uri: parent.ref.uriStr,
                blocked: true,
                author: { did: sc.dids.carol },
              }),
        ])
      },
    )

    it('builds a spotlight across days from multiple raw pages', async () => {
      const { recipient, records, headers } = await seedSpotlight()
      const now = Date.now()
      const notifications = records.map(
        ({ like, post }, index) =>
          new Notification({
            recipientDid: recipient,
            uri: like,
            reason: NOTIFICATION_REASON.LIKE,
            reasonSubject: post.ref.uriStr,
            timestamp: Timestamp.fromDate(new Date(now - index * DAY)),
          }),
      )
      using reads = vi
        .spyOn(network.bsky.ctx.hydrator.dataplane, 'getNotificationsV2')
        .mockResolvedValueOnce(
          new GetNotificationsV2Response({
            notifications: notifications.slice(0, 2),
            cursor: toDatetimeString(new Date(now - DAY)),
          }),
        )
        .mockResolvedValueOnce(
          new GetNotificationsV2Response({
            notifications: notifications.slice(2),
          }),
        )

      const response = await network.bsky
        .getClient()
        .call(defs, { limit: 4 }, { headers })

      expect(reads).toHaveBeenCalledTimes(2)
      expect(response.groups.map(({ kind }) => kind)).toEqual([
        defs.multiPostLikeGroup.$build({
          actor: sc.dids.bob,
          items: records.map(({ post }) => ({ post: post.ref.uriStr })),
        }),
      ])
      expect(response.cursor).toBeUndefined()
    })

    it('builds the spotlight from all fetched pages and hydrates once', async () => {
      const { records, headers } = await seedSpotlight()
      const dataplane = network.bsky.ctx.hydrator.dataplane
      const getNotifications = dataplane.getNotificationsV2.bind(dataplane)
      using reads = vi
        .spyOn(dataplane, 'getNotificationsV2')
        .mockImplementation((request, ...args) =>
          getNotifications({ ...request, limit: 2 }, ...args),
        )
      using hydration = vi.spyOn(
        network.bsky.ctx.hydrator,
        'hydrateGroupedNotifications',
      )

      const response = await network.bsky
        .getClient()
        .call(defs, { limit: 4 }, { headers })

      expect(reads).toHaveBeenCalledTimes(2)
      expect(Date.parse(reads.mock.calls[1]![0].cursor!)).toBe(
        Date.parse(records[1]!.indexedAt),
      )
      expect(hydration).toHaveBeenCalledTimes(1)
      expect(response.groups.map(({ kind }) => kind)).toEqual([
        defs.multiPostLikeGroup.$build({
          actor: sc.dids.bob,
          items: records.map(({ post }) => ({ post: post.ref.uriStr })),
        }),
      ])
      expect(response.cursor).toBeUndefined()
    })

    it('paginates after trimming and sorts again when rules remove the spotlight’s newest like', async () => {
      const { recipient, records, headers } = await seedSpotlight()
      const otherLikes: { uri: AtUriString; indexedAt: DatetimeString }[] = []
      for (const { post, indexedAt } of records) {
        otherLikes.push({
          uri: (await sc.like(sc.dids.carol, post.ref)).toString(),
          indexedAt: toDatetimeString(new Date(Date.parse(indexedAt) - 500)),
        })
      }
      await network.processAll()
      for (const { uri, indexedAt } of otherLikes) {
        await network.bsky.db.db
          .updateTable('notification')
          .set({ sortAt: indexedAt })
          .where('recordUri', '=', uri)
          .where('did', '=', recipient)
          .execute()
      }
      await network.bsky.ctx.dataplane.takedownRecord({
        recordUri: records[0]!.like,
      })
      using reads = vi.spyOn(
        network.bsky.ctx.hydrator.dataplane,
        'getNotificationsV2',
      )
      const client = network.bsky.getClient()

      const first = await client.call(defs, { limit: 4 }, { headers })

      expect(reads).toHaveBeenCalledTimes(1)
      expect(first.groups.map(({ kind }) => kind)).toEqual([
        defs.likeGroup.$build({
          post: records[0]!.post.ref.uriStr,
          items: [{ actor: sc.dids.carol }],
        }),
        defs.multiPostLikeGroup.$build({
          actor: sc.dids.bob,
          items: records
            .slice(1)
            .map(({ post }) => ({ post: post.ref.uriStr })),
        }),
        defs.likeGroup.$build({
          post: records[1]!.post.ref.uriStr,
          items: [{ actor: sc.dids.carol }],
        }),
        defs.likeGroup.$build({
          post: records[2]!.post.ref.uriStr,
          items: [{ actor: sc.dids.carol }],
        }),
      ])
      expect(first.groups[1]?.id).toBe(records[1]!.id)
      expect(first.groups[1]?.indexedAt).toBe(records[1]!.indexedAt)
      expect(first.groups[1]?.count).toBe(3)
      expect(first.cursor).toBe(records[3]!.indexedAt)
      expect(first.relatedViews).toMatchObject([
        ...[sc.dids.carol, sc.dids.bob].map((did) => ({
          $type: app.bsky.actor.defs.profileViewBasic.$type,
          did,
        })),
        ...records.map(({ post }) => ({
          $type: app.bsky.feed.defs.postView.$type,
          uri: post.ref.uriStr,
        })),
      ])

      const second = await client.call(
        defs,
        { limit: 4, cursor: first.cursor },
        { headers },
      )

      expect(reads).toHaveBeenCalledTimes(2)
      expect(second.groups.map(({ kind }) => kind)).toEqual([
        defs.likeGroup.$build({
          post: records[3]!.post.ref.uriStr,
          items: [{ actor: sc.dids.carol }],
        }),
      ])
      expect(second.cursor).toBeUndefined()
      expect(second.relatedViews).toMatchObject([
        {
          $type: app.bsky.actor.defs.profileViewBasic.$type,
          did: sc.dids.carol,
        },
        {
          $type: app.bsky.feed.defs.postView.$type,
          uri: records[3]!.post.ref.uriStr,
        },
      ])
    })
  },
)

describe('adaptive raw notification fetch limit', () => {
  it.each([
    {
      description: 'estimates from the observed notification-to-group ratio',
      itemsFetched: 1200,
      groupsBuilt: 18,
      groupsNeeded: 30,
      expected: 800,
    },
    {
      description: 'caps the estimate at the remaining item budget',
      itemsFetched: 1200,
      groupsBuilt: 6,
      groupsNeeded: 30,
      expected: 1800,
    },
    {
      description: 'estimates additional items for a partially filled page',
      itemsFetched: 300,
      groupsBuilt: 10,
      groupsNeeded: 30,
      expected: 600,
    },
    {
      description: 'fetches a minimum batch when no groups were built',
      itemsFetched: 300,
      groupsBuilt: 0,
      groupsNeeded: 30,
      expected: 300,
    },
    {
      description: 'keeps the minimum batch when only one group is missing',
      itemsFetched: 1200,
      groupsBuilt: 29,
      groupsNeeded: 30,
      expected: 300,
    },
    {
      description: 'fetches more items when enough groups were built',
      itemsFetched: 1200,
      groupsBuilt: 30,
      groupsNeeded: 30,
      expected: 300,
    },
    {
      description: 'caps the minimum batch at the remaining item budget',
      itemsFetched: 2900,
      groupsBuilt: 18,
      groupsNeeded: 30,
      expected: 100,
    },
    {
      description: 'returns zero when the item budget is exhausted',
      itemsFetched: 3000,
      groupsBuilt: 10,
      groupsNeeded: 30,
      expected: 0,
    },
  ])(
    '$description',
    ({ itemsFetched, groupsBuilt, groupsNeeded, expected }) => {
      expect(getNextRawLimit(itemsFetched, groupsBuilt, groupsNeeded)).toBe(
        expected,
      )
    },
  )
})
