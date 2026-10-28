import { HOUR, MINUTE, SECOND } from '@atproto/common'
import { NotificationFeed } from '../../../../../proto/bsky_pb.js'
import type {
  GroupBuilderFactory,
  NotificationGroup,
  NotificationItem,
} from './grouping.js'
import {
  MAX_GROUP_SIZE,
  canGroupNotification,
  compareNotificationGroupsNewestFirst,
  isNotificationRead,
} from './shared.js'

type Zone = {
  ageMs: number | null
  gravity: number
  attractionSpanMs: number
}

type Params = {
  zones: Zone[]
  attractionCoefficient: number
  notificationWeight: number
}

const PARAMS: Params = {
  zones: [
    // @NOTE: Keep in ascending ageMs, null last.
    { ageMs: 30 * MINUTE, gravity: 3, attractionSpanMs: 30 * MINUTE },
    { ageMs: HOUR, gravity: 2.2, attractionSpanMs: HOUR },
    { ageMs: 8 * HOUR, gravity: 1, attractionSpanMs: 12 * HOUR },
    { ageMs: null, gravity: 0.5, attractionSpanMs: 24 * HOUR },
  ],
  attractionCoefficient: 0.9,
  notificationWeight: 0.005,
}

// A notification group while Gravity is building it: holds its notifications and
// the measurements used to decide whether to split it or accept more notifications.
type CandidateGroup = {
  items: NotificationItem[]
  occupiedSeconds: number
  zone: Zone
  weakestAttraction: number
  weakestBindingIndexes: number[]
  closed: boolean
}

export const createAlgoGravityGroupBuilder: GroupBuilderFactory = (
  limit,
  now,
  seenAt,
  feed = NotificationFeed.ALL,
) => {
  const zones = PARAMS.zones
  const chains = new Map<string, CandidateGroup[]>()
  let groupCount = 0
  let previousItem: NotificationItem | undefined

  return (items) => {
    for (const item of items) {
      const canGroup = canGroupNotification(item.raw.reason, feed)
      // @NOTE Null bytes cannot occur in these values, so the key is collision-safe.
      const key = `${item.raw.reason}\0${item.groupingKey}\0${canGroup ? '' : item.id}`
      const candidateGroups = chains.get(key) ?? []
      const nextCandidateGroups = extendCandidateGroups(
        candidateGroups,
        item,
        now,
        zones,
      ).map((candidateGroup) =>
        candidateGroup.items.length === MAX_GROUP_SIZE
          ? { ...candidateGroup, closed: true }
          : candidateGroup,
      )

      const nextGroupCount =
        groupCount - candidateGroups.length + nextCandidateGroups.length
      if (nextGroupCount > limit) {
        return {
          groups: toGroups(chains, seenAt),
          cursor: previousItem?.raw.indexedAt,
        }
      }

      chains.set(key, nextCandidateGroups)
      groupCount = nextGroupCount
      previousItem = item
    }

    return {
      groups: toGroups(chains, seenAt),
    }
  }
}

/** Split newest-first notifications into gravity-bound bursts, without a size cap. */
export const splitGravityBursts = (
  items: NotificationItem[],
  now: number,
  attractionSpanMultiplier: number,
): NotificationItem[][] => {
  const zones = PARAMS.zones.map((zone) => ({
    ...zone,
    attractionSpanMs: zone.attractionSpanMs * attractionSpanMultiplier,
  }))
  let groups: CandidateGroup[] = []
  for (const item of items) {
    groups = extendCandidateGroups(groups, item, now, zones)
  }
  return groups.map((group) => group.items)
}

const extendCandidateGroups = (
  groups: CandidateGroup[],
  item: NotificationItem,
  now: number,
  zones: Zone[],
): CandidateGroup[] => {
  const active = groups.at(-1)
  if (!active || active.closed) {
    return [...groups, createCandidateGroup([item], now, zones)]
  }
  return [
    ...groups.slice(0, -1),
    ...splitUntilStable(
      appendItem(active, item, PARAMS.attractionCoefficient),
      PARAMS.notificationWeight,
      PARAMS.attractionCoefficient,
      now,
      zones,
    ),
  ]
}

const splitUntilStable = (
  candidateGroup: CandidateGroup,
  notificationWeight: number,
  attractionCoefficient: number,
  now: number,
  zones: Zone[],
): CandidateGroup[] => {
  if (
    candidateGroup.items.length < 2 ||
    candidateGroup.occupiedSeconds *
      notificationWeight *
      candidateGroup.zone.gravity <=
      candidateGroup.weakestAttraction
  ) {
    return [candidateGroup]
  }

  // Resolve equal weakest bindings by cutting nearest the segment midpoint.
  const splitIndex = midpointIndex(
    candidateGroup.weakestBindingIndexes,
    candidateGroup.items.length,
  )
  const newer = createCandidateGroup(
    candidateGroup.items.slice(0, splitIndex + 1),
    now,
    zones,
    attractionCoefficient,
  )
  const older = createCandidateGroup(
    candidateGroup.items.slice(splitIndex + 1),
    now,
    zones,
    attractionCoefficient,
  )
  const newerCandidateGroups = splitUntilStable(
    newer,
    notificationWeight,
    attractionCoefficient,
    now,
    zones,
  ).map((part) => ({ ...part, closed: true }))
  const olderCandidateGroups = splitUntilStable(
    older,
    notificationWeight,
    attractionCoefficient,
    now,
    zones,
  )
  return [...newerCandidateGroups, ...olderCandidateGroups]
}

const createCandidateGroup = (
  items: NotificationItem[],
  now: number,
  zones: Zone[],
  attractionCoefficient = PARAMS.attractionCoefficient,
): CandidateGroup => {
  const newest = items[0]!
  const age = Math.max(0, now - newest.indexedTime)
  const zone = zones.find(
    ({ ageMs: maxAgeMs }) => maxAgeMs === null || age <= maxAgeMs,
  )!
  const candidateGroup: CandidateGroup = {
    items,
    occupiedSeconds: new Set(
      items.map(({ indexedTime }) => Math.floor(indexedTime / SECOND)),
    ).size,
    zone,
    weakestAttraction: Number.POSITIVE_INFINITY,
    weakestBindingIndexes: [],
    closed: false,
  }

  for (let index = 0; index < items.length - 1; index++) {
    const gap = items[index]!.indexedTime - items[index + 1]!.indexedTime
    addBindingAttraction(
      candidateGroup,
      index,
      linearAttraction(
        gap,
        attractionCoefficient,
        candidateGroup.zone.attractionSpanMs,
      ),
    )
  }

  return candidateGroup
}

const appendItem = (
  candidateGroup: CandidateGroup,
  item: NotificationItem,
  attractionCoefficient: number,
): CandidateGroup => {
  const newestBindingIndex = candidateGroup.items.length - 1
  const previousTime = candidateGroup.items.at(-1)!.indexedTime
  const itemTime = item.indexedTime
  const gap = previousTime - itemTime
  const extended: CandidateGroup = {
    ...candidateGroup,
    items: [...candidateGroup.items, item],
    occupiedSeconds:
      candidateGroup.occupiedSeconds +
      Number(
        Math.floor(previousTime / SECOND) !== Math.floor(itemTime / SECOND),
      ),
    weakestBindingIndexes: [...candidateGroup.weakestBindingIndexes],
  }
  addBindingAttraction(
    extended,
    newestBindingIndex,
    linearAttraction(
      gap,
      attractionCoefficient,
      candidateGroup.zone.attractionSpanMs,
    ),
  )
  return extended
}

const addBindingAttraction = (
  candidateGroup: CandidateGroup,
  index: number,
  attraction: number,
) => {
  if (attraction < candidateGroup.weakestAttraction) {
    candidateGroup.weakestAttraction = attraction
    candidateGroup.weakestBindingIndexes = [index]
  } else if (attraction === candidateGroup.weakestAttraction) {
    candidateGroup.weakestBindingIndexes.push(index)
  }
}

const midpointIndex = (indexes: number[], itemCount: number): number => {
  const midpoint = (itemCount - 2) / 2
  return indexes.reduce((best, index) =>
    Math.abs(index - midpoint) < Math.abs(best - midpoint) ? index : best,
  )
}

const linearAttraction = (
  gapMs: number,
  attractionCoefficient: number,
  attractionSpanMs: number,
) =>
  attractionCoefficient * Math.max(0, 1 - Math.max(0, gapMs) / attractionSpanMs)

const toGroups = (
  chains: Map<string, CandidateGroup[]>,
  seenAt: number | undefined,
): NotificationGroup[] =>
  [...chains.values()]
    .flatMap((candidateGroups) => candidateGroups)
    .map((candidateGroup) => {
      const newest = candidateGroup.items[0]!
      const oldest = candidateGroup.items.at(-1)!
      return {
        id: newest.id,
        kind: newest.raw.reason,
        groupingKey: newest.groupingKey,
        actorDids: candidateGroup.items.map(({ actorDid }) => actorDid),
        itemCount: candidateGroup.items.length,
        indexedAt: newest.raw.indexedAt,
        firstIndexedAt: oldest.raw.indexedAt,
        isRead: isNotificationRead(newest.raw.indexedAt, seenAt),
        items: candidateGroup.items,
      }
    })
    .sort(compareNotificationGroupsNewestFirst)
