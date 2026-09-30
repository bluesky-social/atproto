import { Timestamp } from '@bufbuild/protobuf'
import { describe, expect, it, vi } from 'vitest'
import type { AtUriString, DidString } from '@atproto/lex'
import {
  NOTIFICATION_REASON,
  type NotificationReason,
} from '../src/api/app/bsky/notification/constants.js'
import { getNextRawLimit } from '../src/api/app/bsky/notification/getGroupedNotifications.js'
import {
  type NotificationItem,
  buildGroups,
  parseRawNotification,
} from '../src/api/app/bsky/notification/grouping/grouping.js'
import { app } from '../src/lexicons/index.js'
import { Notification, NotificationFeed } from '../src/proto/bsky_pb.js'

const NOW = '2026-09-21T12:00:00.000Z'
const post = (name: string) =>
  `at://did:plc:viewer/${app.bsky.feed.post.$type}/${name}` as AtUriString
const minutesAgo = (minutes: number) =>
  new Date(Date.parse(NOW) - minutes * 60_000).toISOString()

const item = (
  id: string,
  indexedAt: string,
  kind: NotificationReason = NOTIFICATION_REASON.LIKE,
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
