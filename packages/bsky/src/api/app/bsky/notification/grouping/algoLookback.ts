import { HOUR, MINUTE } from '@atproto/common'
import { NotificationFeed } from '../../../../../proto/bsky_pb.js'
import type {
  GroupingResult,
  NotificationGroup,
  NotificationItem,
} from './grouping.js'
import {
  MAX_GROUP_SIZE,
  canGroupNotification,
  isNotificationRead,
  localDay,
} from './shared.js'

type Zone = {
  ageMs: number | null
  lookbackMs: number
}

type Params = {
  zones: Zone[]
}

const PARAMS: Params = {
  zones: [
    // @NOTE: Keep in ascending ageMs, null last.
    { ageMs: HOUR, lookbackMs: 30 * MINUTE },
    { ageMs: 12 * HOUR, lookbackMs: HOUR },
    { ageMs: 24 * HOUR, lookbackMs: 4 * HOUR },
    { ageMs: null, lookbackMs: 8 * HOUR },
  ],
}

export const buildAlgoLookbackGroups = (
  items: NotificationItem[],
  limit: number,
  utcOffset: number,
  seenAt?: number,
  feed = NotificationFeed.ALL,
): GroupingResult => {
  const groups: NotificationGroup[] = []
  const activeGroups = new Map<string, NotificationGroup>()

  for (const [itemIndex, item] of items.entries()) {
    const day = localDay(Date.parse(item.raw.indexedAt), utcOffset)
    const canGroup = canGroupNotification(item.raw.reason, feed)
    const key = JSON.stringify([
      item.raw.reason,
      item.groupingKey,
      day,
      canGroup ? undefined : item.id,
    ])
    const active = activeGroups.get(key)
    const age = active
      ? Math.max(0, Date.now() - Date.parse(active.indexedAt))
      : 0
    const zone = active
      ? (PARAMS.zones.find(
          ({ ageMs: maxAgeMs }, index) =>
            maxAgeMs === null ||
            (index === 0 ? age < maxAgeMs : age <= maxAgeMs),
        ) ?? PARAMS.zones.at(-1)!)
      : undefined
    const gap = active
      ? Date.parse(active.indexedAt) - Date.parse(item.raw.indexedAt)
      : Number.POSITIVE_INFINITY

    if (
      active &&
      active.itemCount < MAX_GROUP_SIZE &&
      zone &&
      gap <= zone.lookbackMs
    ) {
      active.actorDids.push(item.actorDid)
      active.itemCount++
      active.firstIndexedAt = item.raw.indexedAt
      active.items.push(item)
      continue
    }

    if (groups.length >= limit) {
      return { groups, cursor: items[itemIndex - 1]?.raw.indexedAt }
    }

    const group: NotificationGroup = {
      id: item.id,
      kind: item.raw.reason,
      groupingKey: item.groupingKey,
      actorDids: [item.actorDid],
      itemCount: 1,
      indexedAt: item.raw.indexedAt,
      firstIndexedAt: item.raw.indexedAt,
      isRead: isNotificationRead(item.raw.indexedAt, seenAt),
      items: [item],
    }
    groups.push(group)
    activeGroups.set(key, group)
  }

  return { groups }
}
