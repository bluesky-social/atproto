import { Timestamp } from '@bufbuild/protobuf'
import { describe, expect, it } from 'vitest'
import type { DidString } from '@atproto/lex'
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
import { Notification } from '../src/proto/bsky_pb.js'

const item = (
  id: string,
  indexedAt: string,
  kind: NotificationReason = NOTIFICATION_REASON.LIKE,
): NotificationItem => {
  const collection =
    kind === NOTIFICATION_REASON.LIKE
      ? app.bsky.feed.like.$type
      : app.bsky.feed.post.$type
  const groupingKey = `at://did:plc:subject/${app.bsky.feed.post.$type}/1`
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
      uri: `at://did:plc:actor/${collection}/${id}`,
      reason: kind,
      ...(reasonSubjectRequired ? { reasonSubject: groupingKey } : {}),
      timestamp: Timestamp.fromJson(indexedAt),
    }),
  )
  if (!raw) throw new Error('Invalid notification fixture')
  return {
    raw,
    id,
    groupingKey,
    actorDid: 'did:plc:actor' as DidString,
  }
}

describe('notification grouping', () => {
  it('uses the last consumed item as cursor when a page fills', () => {
    const items = [
      item('newest', '2026-08-03T12:00:00.000Z'),
      item('other', '2026-08-03T11:00:00.000Z', NOTIFICATION_REASON.MENTION),
    ]
    const result = buildGroups(items, 1, 0, undefined, 'algoGravity')

    expect(result.groups).toHaveLength(1)
    expect(result.cursor).toBe(items[0]?.raw.indexedAt)
  })

  it('selects distinct algoGravity and algoLookback grouping thresholds', () => {
    const newest = Date.now()
    const items = [
      ...Array.from({ length: 21 }, (_, index) =>
        item(`recent-${index}`, new Date(newest - index * 1000).toISOString()),
      ),
      item('older', new Date(newest - 29 * 60_000).toISOString()),
    ]

    expect(
      buildGroups(items, 10, 0, undefined, 'algoGravity').groups.length,
    ).toBeGreaterThan(1)
    expect(
      buildGroups(items, 10, 0, undefined, 'algoLookback').groups,
    ).toHaveLength(1)
  })

  it('marks only items strictly older than the seen timestamp as read', () => {
    const items = [
      item('newest', '2026-08-03T12:00:00.000Z', NOTIFICATION_REASON.MENTION),
      item('older', '2026-08-03T11:00:00.000Z', NOTIFICATION_REASON.REPLY),
    ]
    const result = buildGroups(
      items,
      10,
      0,
      Date.parse('2026-08-03T12:00:00.000Z'),
      'algoGravity',
    )

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
