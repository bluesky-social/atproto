import { HOUR, MINUTE } from '@atproto/common'
import { NotificationFeed } from '../../../../../proto/bsky_pb.js'
import type {
  NotificationGroup,
  NotificationGroupingEvent,
} from './grouping.js'
import {
  MAX_GROUP_SIZE,
  canGroupNotification,
  isNotificationRead,
  localDay,
} from './shared.js'

const ZONES = [
  { maxAgeMs: HOUR, lookbackMs: 30 * MINUTE },
  { maxAgeMs: 12 * HOUR, lookbackMs: HOUR },
  { maxAgeMs: 24 * HOUR, lookbackMs: 4 * HOUR },
  { maxAgeMs: null, lookbackMs: 8 * HOUR },
]
export const buildAlgoLookbackGroups = (
  events: NotificationGroupingEvent[],
  limit: number,
  utcOffset: number,
  seenAt?: number,
  feed = NotificationFeed.ALL,
): { groups: NotificationGroup[]; cursor?: string } => {
  const groups: NotificationGroup[] = []
  const activeGroups = new Map<string, NotificationGroup>()

  for (const [eventIndex, event] of events.entries()) {
    const day = localDay(Date.parse(event.indexedAt), utcOffset)
    const canGroup = canGroupNotification(event.kind, feed)
    const key = JSON.stringify([
      event.kind,
      event.subject,
      day,
      canGroup ? undefined : event.id,
    ])
    const active = activeGroups.get(key)
    const age = active
      ? Math.max(0, Date.now() - Date.parse(active.indexedAt))
      : 0
    const zone = active
      ? (ZONES.find(
          ({ maxAgeMs }, index) =>
            maxAgeMs === null ||
            (index === 0 ? age < maxAgeMs : age <= maxAgeMs),
        ) ?? ZONES.at(-1)!)
      : undefined
    const gap = active
      ? Date.parse(active.indexedAt) - Date.parse(event.indexedAt)
      : Number.POSITIVE_INFINITY

    if (
      active &&
      active.eventCount < MAX_GROUP_SIZE &&
      zone &&
      gap <= zone.lookbackMs
    ) {
      active.actorDids.push(event.actorDid)
      active.eventCount++
      active.firstIndexedAt = event.indexedAt
      active.items.push(event)
      continue
    }

    if (groups.length >= limit) {
      return { groups, cursor: events[eventIndex - 1]?.indexedAt }
    }

    const group: NotificationGroup = {
      id: event.id,
      kind: event.kind,
      subject: event.subject,
      actorDids: [event.actorDid],
      eventCount: 1,
      indexedAt: event.indexedAt,
      firstIndexedAt: event.indexedAt,
      isRead: isNotificationRead(event.indexedAt, seenAt),
      items: [event],
    }
    groups.push(group)
    activeGroups.set(key, group)
  }

  return { groups }
}
