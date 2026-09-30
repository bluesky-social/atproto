import { createHash } from 'node:crypto'
import { Timestamp } from '@bufbuild/protobuf'
import { afterAll, assert, beforeAll, describe, expect, it, vi } from 'vitest'
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
const post = (name: string) =>
  `at://did:plc:viewer/${app.bsky.feed.post.$type}/${name}` as AtUriString
const minutesAgo = (minutes: number) =>
  new Date(Date.parse(NOW) - minutes * 60_000).toISOString()

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
      using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
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

      const result = buildGroups(items, 2, 0, undefined, algorithm)

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
      using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
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

      const firstPage = buildGroups(items, 2, 0, undefined, algorithm)

      expect(
        firstPage.groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([
        ['poem-1', 'poem-2'],
        ['song-1', 'song-2'],
      ])
      expect(firstPage.cursor).toBe(items[3]!.raw.indexedAt)

      const secondPage = buildGroups(items.slice(4), 2, 0, undefined, algorithm)
      expect(
        secondPage.groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([['photo-1'], ['poem-3']])
      expect(secondPage.cursor).toBeUndefined()
    },
  )

  it('Gravity keeps the older group open after a weak connection splits off newer likes', () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const items = [
      item('newer-1', minutesAgo(0)),
      item('newer-2', minutesAgo(1)),
      item('older-1', minutesAgo(60)),
      item('older-2', minutesAgo(61)),
    ]

    const result = buildGroups(items, 2, 0, undefined, 'algoGravity')

    expect(result.groups.map(({ items }) => items.map(({ id }) => id))).toEqual(
      [
        ['newer-1', 'newer-2'],
        ['older-1', 'older-2'],
      ],
    )
  })

  it('Gravity uses the older group’s zone after a split, allowing likes 35 minutes apart to stay together', () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const items = [
      item('newest', minutesAgo(0)),
      item('hour-old', minutesAgo(60)),
      item('older-like', minutesAgo(95)),
    ]

    const result = buildGroups(items, 2, 0, undefined, 'algoGravity')

    expect(result.groups.map(({ items }) => items.map(({ id }) => id))).toEqual(
      [['newest'], ['hour-old', 'older-like']],
    )
  })

  it('Gravity stops before a like that would split a group beyond the page limit', () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const items = [
      item('newer-1', minutesAgo(0)),
      item('newer-2', minutesAgo(1)),
      item('older', minutesAgo(60)),
    ]

    const result = buildGroups(items, 1, 0, undefined, 'algoGravity')

    expect(result.groups[0]?.items.map(({ id }) => id)).toEqual([
      'newer-1',
      'newer-2',
    ])
    expect(result.cursor).toBe(items[1]!.raw.indexedAt)
  })

  it('Gravity splits equally weak connections at the middle-most one', () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const gapMs = 27 * 60_000 + 40_000
    const items = Array.from({ length: 5 }, (_, index) =>
      item(
        `like-${index}`,
        new Date(Date.parse(NOW) - index * gapMs).toISOString(),
      ),
    )

    const result = buildGroups(items, 2, 0, undefined, 'algoGravity')

    expect(result.groups.map(({ items }) => items.map(({ id }) => id))).toEqual(
      [
        ['like-0', 'like-1'],
        ['like-2', 'like-3', 'like-4'],
      ],
    )
  })

  it('Lookback groups likes exactly at its 30-minute boundary; Gravity splits them', () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const items = [item('newest', minutesAgo(1)), item('older', minutesAgo(31))]

    expect(
      buildGroups(items, 2, 0, undefined, 'algoLookback').groups.map(
        ({ itemCount }) => itemCount,
      ),
    ).toEqual([2])
    expect(
      buildGroups(items, 2, 0, undefined, 'algoGravity').groups.map(
        ({ itemCount }) => itemCount,
      ),
    ).toEqual([1, 1])
  })

  it('Lookback expands its grouping window when the newest like becomes one hour old', () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const justUnderAnHour = [
      item('newer', '2026-09-21T11:00:00.001Z'),
      item('older', '2026-09-21T10:15:00.001Z'),
    ]
    const exactlyAnHour = [
      item('newer', '2026-09-21T11:00:00.000Z'),
      item('older', '2026-09-21T10:15:00.000Z'),
    ]

    expect(
      buildGroups(justUnderAnHour, 2, 0, undefined, 'algoLookback').groups.map(
        ({ items }) => items.map(({ id }) => id),
      ),
    ).toEqual([['newer'], ['older']])
    expect(
      buildGroups(exactlyAnHour, 2, 0, undefined, 'algoLookback').groups.map(
        ({ items }) => items.map(({ id }) => id),
      ),
    ).toEqual([['newer', 'older']])
  })

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s starts a new group at the 200-like cap without losing the next like',
    (algorithm) => {
      using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
      const start = Date.parse(minutesAgo(1))
      const items = Array.from({ length: 201 }, (_, index) =>
        item(`like-${index}`, new Date(start - index).toISOString()),
      )

      const firstPage = buildGroups(items, 1, 0, undefined, algorithm)
      expect(firstPage.groups[0]?.items.map(({ id }) => id)).toEqual(
        items.slice(0, 200).map(({ id }) => id),
      )
      expect(firstPage.cursor).toBe(items[199]!.raw.indexedAt)

      const secondPage = buildGroups(
        items.slice(200),
        1,
        0,
        undefined,
        algorithm,
      )
      expect(secondPage.groups[0]?.items.map(({ id }) => id)).toEqual([
        'like-200',
      ])
    },
  )

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s keeps recent likes separate across local midnight but groups them with a shifted UTC offset',
    (algorithm) => {
      using _clock = vi
        .spyOn(Date, 'now')
        .mockReturnValue(Date.parse('2026-09-21T00:05:00.000Z'))
      const items = [
        item('today', '2026-09-21T00:04:00.000Z'),
        item('yesterday', '2026-09-20T23:59:00.000Z'),
      ]

      expect(
        buildGroups(items, 2, 0, undefined, algorithm).groups.map(({ items }) =>
          items.map(({ id }) => id),
        ),
      ).toEqual([['today'], ['yesterday']])
      expect(
        buildGroups(items, 2, -60, undefined, algorithm).groups.map(
          ({ items }) => items.map(({ id }) => id),
        ),
      ).toEqual([['today', 'yesterday']])
    },
  )

  it('Gravity groups older likes across days while Lookback keeps the days separate', () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const items = [
      item('today', '2026-09-21T11:00:00.000Z'),
      item('yesterday', '2026-09-20T00:30:00.000Z'),
      item('older', '2026-09-19T23:30:00.000Z'),
    ]

    expect(
      buildGroups(items, 3, 0, undefined, 'algoGravity').groups.map(
        ({ items }) => items.map(({ id }) => id),
      ),
    ).toEqual([['today'], ['yesterday', 'older']])
    expect(
      buildGroups(items, 3, 0, undefined, 'algoLookback').groups.map(
        ({ items }) => items.map(({ id }) => id),
      ),
    ).toEqual([['today'], ['yesterday'], ['older']])
  })

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s shows followers separately in the followers feed but groups them in all',
    (algorithm) => {
      using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
      const items = [
        item('alice-follow', minutesAgo(0), NOTIFICATION_REASON.FOLLOW, {
          actor: 'alice',
        }),
        item('bob-follow', minutesAgo(1), NOTIFICATION_REASON.FOLLOW, {
          actor: 'bob',
        }),
      ]

      expect(
        buildGroups(items, 2, 0, undefined, algorithm).groups.map(({ items }) =>
          items.map(({ id }) => id),
        ),
      ).toEqual([['alice-follow', 'bob-follow']])
      expect(
        buildGroups(
          items,
          2,
          0,
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
      using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
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
        buildGroups(items, 2, 0, undefined, algorithm).groups.map(({ items }) =>
          items.map(({ id }) => id),
        ),
      ).toEqual([['alice-post-1', 'alice-post-2']])
      expect(
        buildGroups(
          items,
          2,
          0,
          undefined,
          algorithm,
          NotificationFeed.ACTIVITY,
        ).groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([['alice-post-1'], ['alice-post-2']])
    },
  )

  it('marks only items strictly older than the seen timestamp as read', () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const items = [
      item('newest', minutesAgo(0), NOTIFICATION_REASON.MENTION),
      item('older', minutesAgo(60), NOTIFICATION_REASON.REPLY),
    ]
    const result = buildGroups(items, 2, 0, Date.parse(NOW), 'algoGravity')

    expect(result.groups.map(({ isRead }) => isRead)).toEqual([false, true])
  })
})

const postLikes = (pairs: [actor: string, subject: string][]) =>
  pairs.map(([actor, subject], index) =>
    item(
      `${actor}-${subject}`,
      toDatetimeString(new Date(Date.parse(NOW) - index)),
      NOTIFICATION_REASON.LIKE,
      { actor, subject: post(subject) },
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
      using _clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
      const ordinary = buildGroups(items, limit, 0, seenAt, algorithm)
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
      const { page } = buildPage(items, 5, { seenAt: Date.parse(NOW) })

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
      'excludes non-post %s notifications from eligibility',
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
          new Date(Date.parse(NOW) - index * 1000),
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

    const cappedPost = post('capped')
    const cappedGenerator: AtUriString = `at://did:plc:viewer/${app.bsky.feed.generator.$type}/capped`
    const cappedRepost: AtUriString = `at://did:plc:viewer/${app.bsky.feed.repost.$type}/capped`
    const allActors = Array.from({ length: 8 }, (_, index) => ({
      actor: `did:plc:cap-actor-${index}` as DidString,
    }))

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

    it('returns all eight follows with related profiles for only the first five', async () => {
      const follows: {
        actor: DidString
        uri: AtUriString
        indexedAt: DatetimeString
      }[] = []
      for (let index = 0; index < 8; index++) {
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
      expect(group.count).toBe(8)
      expect(group.kind.items).toHaveLength(8)
      expect(group.kind.items).toEqual(follows.map(({ actor }) => ({ actor })))
      expect(Object.keys(response.relatedProfileViews ?? {})).toEqual(
        follows.slice(0, 5).map(({ actor }) => actor),
      )
      expect(response.relatedRecordViews).toEqual({})
      expect(response.cursor).toBeUndefined()
    })

    it.each([undefined, 0, 6])(
      'returns all spotlight items with five related records when like %s is removed',
      async (removedIndex) => {
        const { records, headers } = await seedSpotlight(8)
        if (removedIndex !== undefined) {
          await network.bsky.ctx.dataplane.takedownRecord({
            recordUri: records[removedIndex]!.like,
          })
        }

        const response = await network.bsky
          .getClient()
          .call(defs, { limit: 8 }, { headers })

        expect(response.groups).toHaveLength(1)
        const group = response.groups[0]!
        assert(defs.multiPostLikeGroup.$isTypeOf(group.kind))
        const remaining = records.filter((_, index) => index !== removedIndex)
        expect(group.count).toBe(removedIndex === undefined ? 8 : 7)
        expect(group.kind.items).toHaveLength(
          removedIndex === undefined ? 8 : 7,
        )
        expect(group.kind.items).toEqual(
          remaining.map(({ post }) => ({ post: post.ref.uriStr })),
        )
        expect(group.id).toBe(remaining[0]!.id)
        expect(group.indexedAt).toBe(remaining[0]!.indexedAt)
        expect(Object.keys(response.relatedRecordViews ?? {})).toEqual(
          remaining.slice(0, 5).map(({ post }) => post.ref.uriStr),
        )
        expect(Object.keys(response.relatedProfileViews ?? {})).toEqual([
          sc.dids.bob,
        ])
        expect(response.cursor).toBeUndefined()
      },
    )

    it('returns all subscribed posts with related views for only the first five of each group', async () => {
      const authors = [sc.dids.bob, sc.dids.dan]
      const postGroups = await Promise.all(
        authors.map(async (actor) => {
          const posts: Awaited<ReturnType<SeedClient['post']>>[] = []
          for (let index = 0; index < 8; index++) {
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
      expect(response.groups.map(({ count }) => count)).toEqual([8, 8])
      expect(response.groups.map(({ kind }) => kind)).toEqual(
        postGroups.map(({ actor, posts }) =>
          defs.subscribedPostGroup.$build({
            items: posts.map(({ ref }) => ({ actor, post: ref.uriStr })),
          }),
        ),
      )
      expect(Object.keys(response.relatedRecordViews ?? {})).toEqual(
        postGroups.flatMap(({ posts }) =>
          posts.slice(0, 5).map(({ ref }) => ref.uriStr),
        ),
      )
      expect(Object.keys(response.relatedProfileViews ?? {})).toEqual(authors)
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
        expect(Object.keys(response.relatedProfileViews ?? {})).toEqual(
          remaining ? [sc.dids.bob] : [],
        )
        expect(Object.keys(response.relatedRecordViews ?? {})).toEqual(
          kept.map(({ post }) => post.ref.uriStr),
        )
        for (const view of Object.values(response.relatedProfileViews ?? {})) {
          expect(app.bsky.actor.defs.profileViewDetailed.$matches(view)).toBe(
            true,
          )
        }
        for (const view of Object.values(response.relatedRecordViews ?? {})) {
          expect(app.bsky.feed.defs.postView.$matches(view)).toBe(true)
        }
      },
    )

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
      expect(Object.keys(first.relatedProfileViews ?? {})).toEqual([
        sc.dids.carol,
        sc.dids.bob,
      ])
      expect(Object.keys(first.relatedRecordViews ?? {})).toEqual(
        records.map(({ post }) => post.ref.uriStr),
      )

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
      expect(Object.keys(second.relatedProfileViews ?? {})).toEqual([
        sc.dids.carol,
      ])
      expect(Object.keys(second.relatedRecordViews ?? {})).toEqual([
        records[3]!.post.ref.uriStr,
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
