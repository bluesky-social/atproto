import { describe, expect, it } from 'vitest'
import { NotificationFeed } from '../../../../../proto/bsky_pb.js'
import { NOTIFICATION_REASON } from '../constants.js'
import { item, minutesAgo, now, post } from './_fixtures.test.js'
import { getGroupingAlgorithm } from './grouping.js'

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

      const result = getGroupingAlgorithm(algorithm).createGroupBuilder(
        2,
        now,
      )(items)

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

      const firstPage = getGroupingAlgorithm(algorithm).createGroupBuilder(
        2,
        now,
      )(items)

      expect(
        firstPage.groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([
        ['poem-1', 'poem-2'],
        ['song-1', 'song-2'],
      ])
      expect(firstPage.cursor).toBe(items[3]!.raw.indexedAt)

      const secondPage = getGroupingAlgorithm(algorithm).createGroupBuilder(
        2,
        now,
      )(items.slice(4))
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

    const result = getGroupingAlgorithm('algoGravity').createGroupBuilder(
      2,
      now,
    )(items)

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

    const result = getGroupingAlgorithm('algoGravity').createGroupBuilder(
      2,
      now,
    )(items)

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

    const result = getGroupingAlgorithm('algoGravity').createGroupBuilder(
      1,
      now,
    )(items)

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

    const result = getGroupingAlgorithm('algoGravity').createGroupBuilder(
      2,
      now,
    )(items)

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
      getGroupingAlgorithm('algoLookback')
        .createGroupBuilder(
          2,
          now,
        )(items)
        .groups.map(({ itemCount }) => itemCount),
    ).toEqual([2])
    expect(
      getGroupingAlgorithm('algoGravity')
        .createGroupBuilder(
          2,
          now,
        )(items)
        .groups.map(({ itemCount }) => itemCount),
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
      getGroupingAlgorithm('algoLookback')
        .createGroupBuilder(
          2,
          now,
        )(justUnderAnHour)
        .groups.map(({ items }) => items.map(({ id }) => id)),
    ).toEqual([['newer'], ['older']])
    expect(
      getGroupingAlgorithm('algoLookback')
        .createGroupBuilder(
          2,
          now,
        )(exactlyAnHour)
        .groups.map(({ items }) => items.map(({ id }) => id)),
    ).toEqual([['newer', 'older']])
  })

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s starts a new group at the 100-like cap without losing the next like',
    (algorithm) => {
      const start = Date.parse(minutesAgo(1))
      const items = Array.from({ length: 101 }, (_, index) =>
        item(`like-${index}`, new Date(start - index).toISOString()),
      )

      const firstPage = getGroupingAlgorithm(algorithm).createGroupBuilder(
        1,
        now,
      )(items)
      expect(firstPage.groups[0]?.items.map(({ id }) => id)).toEqual(
        items.slice(0, 100).map(({ id }) => id),
      )
      expect(firstPage.cursor).toBe(items[99]!.raw.indexedAt)

      const secondPage = getGroupingAlgorithm(algorithm).createGroupBuilder(
        1,
        now,
      )(items.slice(100))
      expect(secondPage.groups[0]?.items.map(({ id }) => id)).toEqual([
        'like-100',
      ])
    },
  )

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s caps subscribed-post groups at 100 across batches without losing the next post',
    (algorithm) => {
      const items = Array.from({ length: 101 }, (_, index) =>
        item(
          `post-${index}`,
          minutesAgo(index / 1000),
          NOTIFICATION_REASON.SUBSCRIBED_POST,
        ),
      )
      const buildGroups = getGroupingAlgorithm(algorithm).createGroupBuilder(
        1,
        now,
      )

      expect(buildGroups(items.slice(0, 99)).cursor).toBeUndefined()
      expect(buildGroups(items.slice(99, 100)).cursor).toBeUndefined()
      const firstPage = buildGroups(items.slice(100))
      expect(firstPage.groups[0]?.items).toEqual(items.slice(0, 100))
      expect(firstPage.cursor).toBe(items[99]!.raw.indexedAt)

      const secondPage = getGroupingAlgorithm(algorithm).createGroupBuilder(
        1,
        now,
      )(items.slice(100))
      expect(secondPage.groups[0]?.items).toEqual([items[100]])
      expect(secondPage.cursor).toBeUndefined()
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
        getGroupingAlgorithm(algorithm)
          .createGroupBuilder(
            2,
            now,
          )(items)
          .groups.map(({ items }) => items.map(({ id }) => id)),
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
        getGroupingAlgorithm(algorithm)
          .createGroupBuilder(
            3,
            now,
          )(items)
          .groups.map(({ items }) => items.map(({ id }) => id)),
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

      const result = getGroupingAlgorithm(algorithm).createGroupBuilder(
        1,
        now,
      )(items)
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
        getGroupingAlgorithm(algorithm)
          .createGroupBuilder(
            2,
            now,
          )(items)
          .groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([['alice-follow', 'bob-follow']])
      expect(
        getGroupingAlgorithm(algorithm)
          .createGroupBuilder(
            2,
            now,
            undefined,
            NotificationFeed.FOLLOWERS,
          )(items)
          .groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([['alice-follow'], ['bob-follow']])
    },
  )

  it.each(['algoGravity', 'algoLookback'] as const)(
    '%s shows subscribed posts separately in activity but groups posts across actors in all',
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
        item('bob-post', minutesAgo(2), NOTIFICATION_REASON.SUBSCRIBED_POST, {
          actor: 'bob',
        }),
      ]

      expect(
        getGroupingAlgorithm(algorithm)
          .createGroupBuilder(
            3,
            now,
          )(items)
          .groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([['alice-post-1', 'alice-post-2', 'bob-post']])
      expect(
        getGroupingAlgorithm(algorithm)
          .createGroupBuilder(
            3,
            now,
            undefined,
            NotificationFeed.ACTIVITY,
          )(items)
          .groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([['alice-post-1'], ['alice-post-2'], ['bob-post']])
    },
  )

  it('marks only items strictly older than the seen timestamp as read', () => {
    const items = [
      item('newest', minutesAgo(0), NOTIFICATION_REASON.MENTION),
      item('older', minutesAgo(60), NOTIFICATION_REASON.REPLY),
    ]
    const result = getGroupingAlgorithm('algoGravity').createGroupBuilder(
      2,
      now,
      now,
    )(items)

    expect(result.groups.map(({ isRead }) => isRead)).toEqual([false, true])
  })
})

describe.each(['algoGravity', 'algoLookback'] as const)(
  '%s incremental grouping',
  (algorithm) => {
    it('extends interleaved groups across batches after reaching the group limit', () => {
      const items = [
        item('poem-1', minutesAgo(0), NOTIFICATION_REASON.LIKE, {
          subject: post('poem'),
        }),
        item('song-1', minutesAgo(1), NOTIFICATION_REASON.LIKE, {
          subject: post('song'),
        }),
        item('poem-2', minutesAgo(2), NOTIFICATION_REASON.LIKE, {
          subject: post('poem'),
        }),
        item('song-2', minutesAgo(3), NOTIFICATION_REASON.LIKE, {
          subject: post('song'),
        }),
        item('photo-1', minutesAgo(4), NOTIFICATION_REASON.LIKE, {
          subject: post('photo'),
        }),
      ]
      const { createGroupBuilder } = getGroupingAlgorithm(algorithm)
      const expected = createGroupBuilder(2, now, now)(items)
      expect(
        expected.groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([
        ['poem-1', 'poem-2'],
        ['song-1', 'song-2'],
      ])
      expect(expected.cursor).toBe(items[3]!.raw.indexedAt)

      for (let boundary = 1; boundary < items.length; boundary++) {
        const buildGroups = createGroupBuilder(2, now, now)
        expect(buildGroups(items.slice(0, boundary)).cursor).toBeUndefined()
        expect(buildGroups([]).cursor).toBeUndefined()
        expect(buildGroups(items.slice(boundary))).toEqual(expected)
      }
    })

    it('splits an existing group when an older batch arrives and keeps its older group open', () => {
      const items = [
        item('newer-1', minutesAgo(0)),
        item('newer-2', minutesAgo(1)),
        item('older-1', minutesAgo(60)),
        item('older-2', minutesAgo(95)),
      ]
      const { createGroupBuilder } = getGroupingAlgorithm(algorithm)
      const expected = createGroupBuilder(2, now, now)(items)
      expect(
        expected.groups.map(({ items }) => items.map(({ id }) => id)),
      ).toEqual([
        ['newer-1', 'newer-2'],
        ['older-1', 'older-2'],
      ])

      for (let boundary = 1; boundary < items.length; boundary++) {
        const buildGroups = createGroupBuilder(2, now, now)
        expect(buildGroups(items.slice(0, boundary)).cursor).toBeUndefined()
        expect(buildGroups(items.slice(boundary))).toEqual(expected)
      }
    })

    it('preserves the existing group and cursor when the next batch would split beyond the limit', () => {
      const items = [
        item('newer-1', minutesAgo(0)),
        item('newer-2', minutesAgo(1)),
        item('older', minutesAgo(60)),
      ]
      const { createGroupBuilder } = getGroupingAlgorithm(algorithm)
      const buildGroups = createGroupBuilder(1, now)
      buildGroups(items.slice(0, 2))
      const result = buildGroups(items.slice(2))

      expect(result).toEqual(createGroupBuilder(1, now)(items))
      expect(result.groups[0]?.items.map(({ id }) => id)).toEqual([
        'newer-1',
        'newer-2',
      ])
      expect(result.cursor).toBe(items[1]!.raw.indexedAt)
    })

    it('retains the 100-item cap and uses the previous batch’s last item as the cursor', () => {
      const items = Array.from({ length: 101 }, (_, index) =>
        item(`like-${index}`, new Date(now - index).toISOString()),
      )
      const { createGroupBuilder } = getGroupingAlgorithm(algorithm)
      const buildGroups = createGroupBuilder(1, now)
      buildGroups(items.slice(0, 99))
      expect(buildGroups(items.slice(99, 100)).cursor).toBeUndefined()
      const result = buildGroups(items.slice(100))

      expect(result).toEqual(createGroupBuilder(1, now)(items))
      expect(result.groups[0]?.itemCount).toBe(100)
      expect(result.cursor).toBe(items[99]!.raw.indexedAt)
    })

    it.each([
      { reason: NOTIFICATION_REASON.FOLLOW, feed: NotificationFeed.FOLLOWERS },
      {
        reason: NOTIFICATION_REASON.SUBSCRIBED_POST,
        feed: NotificationFeed.ACTIVITY,
      },
    ])(
      'preserves individual $reason notifications across batches in feed $feed',
      ({ reason, feed }) => {
        const items = [
          item('first', minutesAgo(0), reason),
          item('second', minutesAgo(1), reason),
        ]
        const { createGroupBuilder } = getGroupingAlgorithm(algorithm)
        const buildGroups = createGroupBuilder(2, now, undefined, feed)
        buildGroups(items.slice(0, 1))
        const result = buildGroups(items.slice(1))

        expect(result).toEqual(
          createGroupBuilder(2, now, undefined, feed)(items),
        )
        expect(result.groups.map(({ itemCount }) => itemCount)).toEqual([1, 1])
      },
    )
  },
)
