import { describe, expect, it } from 'vitest'
import type { DatetimeString, DidString } from '@atproto/lex'
import { NOTIFICATION_REASON } from '../src/api/app/bsky/notification/constants.js'
import {
  type NotificationGroupingEvent,
  buildGroups,
} from '../src/api/app/bsky/notification/grouping/grouping.js'

const event = (
  id: string,
  indexedAt: string,
  kind = NOTIFICATION_REASON.LIKE,
): NotificationGroupingEvent => ({
  id,
  kind,
  subject: 'at://did:plc:subject/app.bsky.feed.post/1',
  actorDid: 'did:plc:actor' as DidString,
  indexedAt: indexedAt as DatetimeString,
})

describe('notification grouping', () => {
  it('uses the last consumed event as cursor when a page fills', () => {
    const events = [
      event('newest', '2026-08-03T12:00:00.000Z'),
      event('other', '2026-08-03T11:00:00.000Z', NOTIFICATION_REASON.MENTION),
    ]
    const result = buildGroups(events, 1, 0, undefined, 'algoGravity')

    expect(result.groups).toHaveLength(1)
    expect(result.cursor).toBe(events[0]?.indexedAt)
  })

  it('selects distinct algoGravity and algoLookback grouping thresholds', () => {
    const newest = Date.now()
    const events = [
      ...Array.from({ length: 21 }, (_, index) =>
        event(`recent-${index}`, new Date(newest - index * 1000).toISOString()),
      ),
      event('older', new Date(newest - 29 * 60_000).toISOString()),
    ]

    expect(
      buildGroups(events, 10, 0, undefined, 'algoGravity').groups.length,
    ).toBeGreaterThan(1)
    expect(
      buildGroups(events, 10, 0, undefined, 'algoLookback').groups,
    ).toHaveLength(1)
  })

  it('marks only events strictly older than the seen timestamp as read', () => {
    const events = [
      event('newest', '2026-08-03T12:00:00.000Z', NOTIFICATION_REASON.MENTION),
      event('older', '2026-08-03T11:00:00.000Z', NOTIFICATION_REASON.REPLY),
    ]
    const result = buildGroups(
      events,
      10,
      0,
      Date.parse('2026-08-03T12:00:00.000Z'),
      'algoGravity',
    )

    expect(result.groups.map(({ isRead }) => isRead)).toEqual([false, true])
  })
})
