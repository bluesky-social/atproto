import { HOUR, MINUTE } from '@atproto/common'
import { NotificationFeed } from '../../../../../proto/bsky_pb.js'
import type {
  GroupBuilderFactory,
  NotificationGroup,
  NotificationItem,
} from './grouping.js'
import {
  MAX_GROUP_SIZE,
  canGroupNotification,
  isNotificationRead,
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

export const createAlgoLookbackGroupBuilder: GroupBuilderFactory = (
  limit,
  now,
  seenAt,
  feed = NotificationFeed.ALL,
) => {
  const groups: NotificationGroup[] = []
  const activeGroups = new Map<string, NotificationGroup>()
  let previousItem: NotificationItem | undefined

  return (items) => {
    for (const item of items) {
      const canGroup = canGroupNotification(item.raw.reason, feed)
      // @NOTE Null bytes cannot occur in these values, so the key is collision-safe.
      const key = `${item.raw.reason}\0${item.groupingKey}\0${canGroup ? '' : item.id}`
      const active = activeGroups.get(key)
      if (
        active &&
        active.itemCount < MAX_GROUP_SIZE &&
        isWithinLookback(active.items[0]!, item, now, 1)
      ) {
        active.actorDids.push(item.actorDid)
        active.itemCount++
        active.firstIndexedAt = item.raw.indexedAt
        active.items.push(item)
        previousItem = item
        continue
      }

      if (groups.length >= limit) {
        return { groups, cursor: previousItem?.raw.indexedAt }
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
      previousItem = item
    }

    return { groups }
  }
}

/** Split newest-first notifications into lookback windows, without a size cap. */
export const splitLookbackBursts = (
  items: NotificationItem[],
  now: number,
  timeSpanMultiplier: number,
): NotificationItem[][] => {
  const groups: NotificationItem[][] = []
  for (const item of items) {
    const active = groups.at(-1)
    if (active && isWithinLookback(active[0]!, item, now, timeSpanMultiplier)) {
      active.push(item)
    } else {
      groups.push([item])
    }
  }
  return groups
}

const isWithinLookback = (
  newest: NotificationItem,
  item: NotificationItem,
  now: number,
  timeSpanMultiplier: number,
): boolean => {
  const newestTime = newest.indexedTime
  const age = Math.max(0, now - newestTime)
  const zone = PARAMS.zones.find(
    ({ ageMs: maxAgeMs }, index) =>
      maxAgeMs === null || (index === 0 ? age < maxAgeMs : age <= maxAgeMs),
  )!
  const gap = newestTime - item.indexedTime
  return gap <= zone.lookbackMs * timeSpanMultiplier
}
