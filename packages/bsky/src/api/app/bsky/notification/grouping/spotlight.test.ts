import { describe, expect, it } from 'vitest'
import { DAY } from '@atproto/common'
import { toDatetimeString } from '@atproto/lex'
import { app } from '../../../../../lexicons/index.js'
import {
  APPVIEW_NOTIFICATION_REASON,
  NOTIFICATION_REASON,
} from '../constants.js'
import {
  NOW,
  item,
  minutesAgo,
  now,
  post,
  spotlightTypes,
} from './_fixtures.test.js'
import { type NotificationItem, getGroupingAlgorithm } from './grouping.js'
import { buildSpotlight } from './spotlight.js'

const postLikes = (pairs: [actor: string, subject: string][]) =>
  pairs.map(([actor, subject], index) =>
    item(
      `${actor}-${subject}`,
      toDatetimeString(new Date(now - index)),
      NOTIFICATION_REASON.LIKE,
      { actor, subject: post(subject) },
    ),
  )

const spotlightItems = (
  type: (typeof spotlightTypes)[number],
  count: number,
  {
    actor = 'alice',
    offset = 0,
    spacing = 1 / 1000,
    olderFrom,
  }: {
    actor?: string
    offset?: number
    spacing?: number
    olderFrom?: number
  } = {},
) =>
  Array.from({ length: count }, (_, index) =>
    item(
      `${type.reason}-${actor}-${index}`,
      minutesAgo(
        offset +
          index * spacing +
          (olderFrom !== undefined && index >= olderFrom ? DAY / 60_000 : 0),
      ),
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
      const { createGroupBuilder, splitBursts } =
        getGroupingAlgorithm(algorithm)
      const ordinary = createGroupBuilder(limit, now, seenAt)(items)
      if (cursor !== undefined) ordinary.cursor = cursor
      const originals = structuredClone({ items, ordinary })
      const page = buildSpotlight(
        items,
        ordinary.groups,
        ordinary.cursor,
        limit,
        now,
        seenAt,
        splitBursts,
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
      it.each(
        algorithm === 'algoGravity'
          ? [
              { offset: 0, spacing: 45, eligible: true },
              { offset: 0, spacing: 57, eligible: false },
              { offset: 0, spacing: 60, eligible: false },
              { offset: 45, spacing: 90, eligible: true },
              { offset: 45, spacing: 120, eligible: false },
              { offset: 120, spacing: 18 * 60, eligible: true },
              { offset: 120, spacing: 24 * 60, eligible: false },
              { offset: 9 * 60, spacing: 36 * 60, eligible: true },
              { offset: 9 * 60, spacing: 48 * 60, eligible: false },
            ]
          : [
              { offset: 0, spacing: 20, eligible: true },
              { offset: 0, spacing: 21, eligible: false },
              { offset: 60, spacing: 40, eligible: true },
              { offset: 60, spacing: 41, eligible: false },
              { offset: 12 * 60 + 1, spacing: 160, eligible: true },
              { offset: 12 * 60 + 1, spacing: 161, eligible: false },
              { offset: 24 * 60 + 1, spacing: 320, eligible: true },
              { offset: 24 * 60 + 1, spacing: 321, eligible: false },
            ],
      )(
        'uses doubled time spans: newest $offset minutes ago, gaps $spacing minutes, eligible=$eligible',
        ({ offset, spacing, eligible }) => {
          const items = spotlightItems(type, 4, { offset, spacing })
          const { ordinary, page } = buildPage(items, items.length)

          expectPage(
            page,
            items,
            eligible
              ? [items.map(({ id }) => id)]
              : items.map(({ id }) => [id]),
          )
          if (eligible) expect(page.groups[0]?.kind).toBe(type.kind)
          else expect(page.groups).toBe(ordinary.groups)
        },
      )

      it('does not combine separate bursts to reach the four-item threshold', () => {
        const items = spotlightItems(type, 4, { olderFrom: 2 })
        const { ordinary, page } = buildPage(items, items.length)

        expect(page.groups).toBe(ordinary.groups)
        expectPage(
          page,
          items,
          items.map(({ id }) => [id]),
        )
      })

      it('does not combine separate bursts to reach the eight-item threshold', () => {
        const matching = spotlightItems(type, 8, { olderFrom: 4 })
        const items = [
          ...matching,
          ...Array.from({ length: 201 - matching.length }, (_, index) =>
            item(
              `follow-${index}`,
              minutesAgo(2 * 24 * 60 + index / 1000),
              NOTIFICATION_REASON.FOLLOW,
            ),
          ),
        ]
        const { ordinary, page } = buildPage(items, 30)

        expect(page.groups).toBe(ordinary.groups)
        expect(page.groups.some(({ kind }) => kind === type.kind)).toBe(false)
      })

      it('chooses the strongest burst rather than the actor with the most total activity', () => {
        const alice = spotlightItems(type, 6, { olderFrom: 3 })
        const bob = spotlightItems(type, 4, { actor: 'bob', offset: 1 })
        const items = [...alice.slice(0, 3), ...bob, ...alice.slice(3)]
        const { page } = buildPage(items, items.length)

        expectPage(page, items, [
          ...alice.slice(0, 3).map(({ id }) => [id]),
          bob.map(({ id }) => id),
          ...alice.slice(3).map(({ id }) => [id]),
        ])
        expect(page.groups[3]?.kind).toBe(type.kind)
      })

      it('can select an older burst and leaves the actor’s isolated recent activity ordinary', () => {
        const items = spotlightItems(type, 5, { olderFrom: 1 })
        const { page } = buildPage(items, items.length)

        expectPage(page, items, [
          [items[0]!.id],
          items.slice(1).map(({ id }) => id),
        ])
        expect(page.groups.map(({ kind }) => kind)).toEqual([
          type.reason,
          type.kind,
        ])
      })

      it('breaks equal burst counts by burst recency, not the actor’s latest activity', () => {
        const alice = spotlightItems(type, 5, { olderFrom: 1 })
        const bob = spotlightItems(type, 4, { actor: 'bob', offset: 1 })
        const items = [alice[0]!, ...bob, ...alice.slice(1)]
        const { page } = buildPage(items, items.length)

        expectPage(page, items, [
          [alice[0]!.id],
          bob.map(({ id }) => id),
          ...alice.slice(1).map(({ id }) => [id]),
        ])
        expect(page.groups[1]?.kind).toBe(type.kind)
      })

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
        const items = spotlightItems(type, 101)
        const { page } = buildPage(items, 101)
        expectPage(page, items, [
          items.slice(0, 100).map(({ id }) => id),
          [items[100]!.id],
        ])
        expect(
          page.groups.map(({ kind, itemCount }) => [kind, itemCount]),
        ).toEqual([
          [type.kind, 100],
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

    it('keeps the selected spotlight when another actor has more likes after trimming', () => {
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
      const { page } = buildPage(items, 6)

      expectPage(
        page,
        items,
        [
          ['alice-poem', 'alice-song', 'alice-photo', 'alice-story'],
          ['bob-poem'],
          ['bob-song'],
          ['bob-photo'],
          ['bob-story'],
          ['bob-drawing'],
        ],
        items[8]!.raw.indexedAt,
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

    it('keeps the selected spotlight when trimming creates a tie with another actor’s newer like', () => {
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
      const { page } = buildPage(items, 5)

      expectPage(
        page,
        items,
        [
          ['bob-poem'],
          ['alice-poem', 'alice-song', 'alice-photo', 'alice-story'],
          ['bob-song'],
          ['bob-photo'],
          ['bob-story'],
        ],
        items[7]!.raw.indexedAt,
      )
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
      const { ordinary, page } = buildPage(items, 6)

      expect(page.groups).toBe(ordinary.groups)
      expectPage(page, items, [
        ['alice-poem'],
        ['alice-song'],
        ['alice-photo'],
        ['alice-story'],
        Array.from({ length: 100 }, (_, index) => `follow-${index}`),
        Array.from({ length: 97 }, (_, index) => `follow-${100 + index}`),
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

    it('keeps likes beyond the 100-item spotlight cap in ordinary groups', () => {
      const items = postLikes(
        Array.from({ length: 101 }, (_, index) => ['alice', `post-${index}`]),
      )
      const { page } = buildPage(items, 101)

      expectPage(page, items, [
        Array.from({ length: 100 }, (_, index) => `alice-post-${index}`),
        ['alice-post-100'],
      ])
      expect(
        page.groups.map(({ kind, itemCount }) => [kind, itemCount]),
      ).toEqual([
        [APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE, 100],
        ['like', 1],
      ])
    })
  },
)
