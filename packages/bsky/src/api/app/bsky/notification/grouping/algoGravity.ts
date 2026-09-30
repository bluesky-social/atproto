import { HOUR, MINUTE, SECOND } from '@atproto/common'
import { NotificationFeed } from '../../../../../proto/bsky_pb.js'
import type {
  GroupingResult,
  NotificationGroup,
  NotificationItem,
} from './grouping.js'
import {
  MAX_GROUP_SIZE,
  canGroupNotification,
  compareNotificationGroupsNewestFirst,
  isNotificationRead,
  localDay,
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

export const buildAlgoGravityGroups = (
  items: NotificationItem[],
  limit: number,
  utcOffset: number,
  seenAt?: number,
  feed = NotificationFeed.ALL,
): GroupingResult => {
  const now = Date.now()
  const zones = PARAMS.zones
  const currentDay = localDay(now, utcOffset)
  const chains = new Map<string, CandidateGroup[]>()
  let groupCount = 0

  for (const [itemIndex, item] of items.entries()) {
    const dayBucket =
      localDay(Date.parse(item.raw.indexedAt), utcOffset) === currentDay
        ? 'current'
        : 'older'
    const canGroup = canGroupNotification(item.raw.reason, feed)
    const key = JSON.stringify([
      item.raw.reason,
      item.groupingKey,
      dayBucket,
      canGroup ? undefined : item.id,
    ])
    const candidateGroups = chains.get(key) ?? []
    const active = candidateGroups.at(-1)
    let nextCandidateGroups: CandidateGroup[]

    if (!active || active.closed) {
      nextCandidateGroups = [
        ...candidateGroups,
        createCandidateGroup([item], now, zones),
      ]
    } else {
      const extended = appendItem(active, item, PARAMS.attractionCoefficient)
      const stableCandidateGroups = splitUntilStable(
        extended,
        PARAMS.notificationWeight,
        PARAMS.attractionCoefficient,
        now,
        zones,
      ).map((candidateGroup) =>
        candidateGroup.items.length === MAX_GROUP_SIZE
          ? { ...candidateGroup, closed: true }
          : candidateGroup,
      )
      nextCandidateGroups = [
        ...candidateGroups.slice(0, -1),
        ...stableCandidateGroups,
      ]
    }

    const nextGroupCount =
      groupCount - candidateGroups.length + nextCandidateGroups.length
    if (nextGroupCount > limit) {
      return {
        groups: toGroups(chains, seenAt),
        cursor: items[itemIndex - 1]?.raw.indexedAt,
      }
    }

    chains.set(key, nextCandidateGroups)
    groupCount = nextGroupCount
  }

  return {
    groups: toGroups(chains, seenAt),
  }
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
  const age = Math.max(0, now - Date.parse(newest.raw.indexedAt))
  const zone = zones.find(
    ({ ageMs: maxAgeMs }) => maxAgeMs === null || age <= maxAgeMs,
  )!
  const candidateGroup: CandidateGroup = {
    items,
    occupiedSeconds: new Set(
      items.map(({ raw }) => Math.floor(Date.parse(raw.indexedAt) / SECOND)),
    ).size,
    zone,
    weakestAttraction: Number.POSITIVE_INFINITY,
    weakestBindingIndexes: [],
    closed: false,
  }

  for (let index = 0; index < items.length - 1; index++) {
    const gap =
      Date.parse(items[index]!.raw.indexedAt) -
      Date.parse(items[index + 1]!.raw.indexedAt)
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
  const previousTime = Date.parse(candidateGroup.items.at(-1)!.raw.indexedAt)
  const itemTime = Date.parse(item.raw.indexedAt)
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
