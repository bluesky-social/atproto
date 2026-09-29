import { HOUR, MINUTE, SECOND } from '@atproto/common'
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

const DEFAULT_PARAMS = {
  gravityZones: [
    { maxAgeMs: 30 * MINUTE, gravity: 3, attractionDecaySpan: 30 * MINUTE },
    { maxAgeMs: HOUR, gravity: 2.2, attractionDecaySpan: HOUR },
    {
      maxAgeMs: 8 * HOUR,
      gravity: 1,
      attractionDecaySpan: 12 * HOUR,
    },
    { maxAgeMs: null, gravity: 0.5, attractionDecaySpan: 24 * HOUR },
  ],
  attractionCoefficient: 0.9,
  notificationWeight: 0.005,
}
type Segment = {
  events: NotificationGroupingEvent[]
  occupiedSeconds: number
  gravity: number
  attractionDecaySpan: number
  weakestAttraction: number
  weakestBindingIndexes: number[]
  closed: boolean
}

export const buildAlgoGravityGroups = (
  events: NotificationGroupingEvent[],
  limit: number,
  utcOffset: number,
  seenAt?: number,
  feed = NotificationFeed.ALL,
): { groups: NotificationGroup[]; cursor?: string } => {
  const now = Date.now()
  const zones = [...DEFAULT_PARAMS.gravityZones].sort(
    (left, right) =>
      (left.maxAgeMs ?? Number.POSITIVE_INFINITY) -
      (right.maxAgeMs ?? Number.POSITIVE_INFINITY),
  )
  const currentDay = localDay(now, utcOffset)
  const eventOrder = new Map(events.map((event, index) => [event, index]))
  const chains = new Map<string, Segment[]>()
  let groupCount = 0

  for (const [eventIndex, event] of events.entries()) {
    const dayBucket =
      localDay(Date.parse(event.indexedAt), utcOffset) === currentDay
        ? 'current'
        : 'older'
    const canGroup = canGroupNotification(event.kind, feed)
    const key = JSON.stringify([
      event.kind,
      event.subject,
      dayBucket,
      canGroup ? undefined : event.id,
    ])
    const segments = chains.get(key) ?? []
    const active = segments.at(-1)
    let nextSegments: Segment[]

    if (!active || active.closed) {
      nextSegments = [...segments, createSegment([event], now, zones)]
    } else {
      const extended = appendEvent(
        active,
        event,
        DEFAULT_PARAMS.attractionCoefficient,
      )
      const stableSegments = splitUntilStable(
        extended,
        DEFAULT_PARAMS.notificationWeight,
        DEFAULT_PARAMS.attractionCoefficient,
        now,
        zones,
      ).map((segment) =>
        segment.events.length === MAX_GROUP_SIZE
          ? { ...segment, closed: true }
          : segment,
      )
      nextSegments = [...segments.slice(0, -1), ...stableSegments]
    }

    const nextGroupCount = groupCount - segments.length + nextSegments.length
    if (nextGroupCount > limit) {
      return {
        groups: toGroups(chains, eventOrder, seenAt),
        cursor: events[eventIndex - 1]?.indexedAt,
      }
    }

    chains.set(key, nextSegments)
    groupCount = nextGroupCount
  }

  return {
    groups: toGroups(chains, eventOrder, seenAt),
  }
}

const splitUntilStable = (
  segment: Segment,
  notificationWeight: number,
  attractionCoefficient: number,
  now: number,
  zones: typeof DEFAULT_PARAMS.gravityZones,
): Segment[] => {
  if (
    segment.events.length < 2 ||
    segment.occupiedSeconds * notificationWeight * segment.gravity <=
      segment.weakestAttraction
  ) {
    return [segment]
  }

  const splitIndex = midpointIndex(
    segment.weakestBindingIndexes,
    segment.events.length,
  )
  const newer = createSegment(
    segment.events.slice(0, splitIndex + 1),
    now,
    zones,
    attractionCoefficient,
  )
  const older = createSegment(
    segment.events.slice(splitIndex + 1),
    now,
    zones,
    attractionCoefficient,
  )
  const newerSegments = splitUntilStable(
    newer,
    notificationWeight,
    attractionCoefficient,
    now,
    zones,
  ).map((part) => ({ ...part, closed: true }))
  const olderSegments = splitUntilStable(
    older,
    notificationWeight,
    attractionCoefficient,
    now,
    zones,
  )
  return [...newerSegments, ...olderSegments]
}

const createSegment = (
  events: NotificationGroupingEvent[],
  now: number,
  zones: typeof DEFAULT_PARAMS.gravityZones,
  attractionCoefficient = DEFAULT_PARAMS.attractionCoefficient,
): Segment => {
  const newest = events[0]!
  const age = Math.max(0, now - Date.parse(newest.indexedAt))
  const zone =
    zones.find(({ maxAgeMs }) => maxAgeMs === null || age <= maxAgeMs) ??
    zones.at(-1)!
  const segment: Segment = {
    events,
    occupiedSeconds: new Set(
      events.map(({ indexedAt }) => Math.floor(Date.parse(indexedAt) / SECOND)),
    ).size,
    gravity: zone.gravity,
    attractionDecaySpan: zone.attractionDecaySpan,
    weakestAttraction: Number.POSITIVE_INFINITY,
    weakestBindingIndexes: [],
    closed: false,
  }

  for (let index = 0; index < events.length - 1; index++) {
    const gap =
      Date.parse(events[index]!.indexedAt) -
      Date.parse(events[index + 1]!.indexedAt)
    addBindingAttraction(
      segment,
      index,
      linearAttraction(gap, attractionCoefficient, segment.attractionDecaySpan),
    )
  }

  return segment
}

const appendEvent = (
  segment: Segment,
  event: NotificationGroupingEvent,
  attractionCoefficient: number,
): Segment => {
  const newestBindingIndex = segment.events.length - 1
  const previousTime = Date.parse(segment.events.at(-1)!.indexedAt)
  const eventTime = Date.parse(event.indexedAt)
  const gap = previousTime - eventTime
  const extended: Segment = {
    ...segment,
    events: [...segment.events, event],
    occupiedSeconds:
      segment.occupiedSeconds +
      Number(
        Math.floor(previousTime / SECOND) !== Math.floor(eventTime / SECOND),
      ),
    weakestBindingIndexes: [...segment.weakestBindingIndexes],
  }
  addBindingAttraction(
    extended,
    newestBindingIndex,
    linearAttraction(gap, attractionCoefficient, segment.attractionDecaySpan),
  )
  return extended
}

const addBindingAttraction = (
  segment: Segment,
  index: number,
  attraction: number,
) => {
  if (attraction < segment.weakestAttraction) {
    segment.weakestAttraction = attraction
    segment.weakestBindingIndexes = [index]
  } else if (attraction === segment.weakestAttraction) {
    segment.weakestBindingIndexes.push(index)
  }
}

const midpointIndex = (indexes: number[], eventCount: number): number => {
  const midpoint = (eventCount - 2) / 2
  return indexes.reduce((best, index) =>
    Math.abs(index - midpoint) < Math.abs(best - midpoint) ? index : best,
  )
}

const linearAttraction = (
  gapMs: number,
  attractionCoefficient: number,
  attractionDecaySpan: number,
) =>
  attractionCoefficient *
  Math.max(0, 1 - Math.max(0, gapMs) / attractionDecaySpan)

const toGroups = (
  chains: Map<string, Segment[]>,
  eventOrder: Map<NotificationGroupingEvent, number>,
  seenAt: number | undefined,
): NotificationGroup[] =>
  [...chains.values()]
    .flatMap((segments) => segments)
    .sort(
      (left, right) =>
        eventOrder.get(left.events[0]!)! - eventOrder.get(right.events[0]!)!,
    )
    .map((segment) => {
      const newest = segment.events[0]!
      const oldest = segment.events.at(-1)!
      return {
        id: newest.id,
        kind: newest.kind,
        subject: newest.subject,
        actorDids: segment.events.map(({ actorDid }) => actorDid),
        eventCount: segment.events.length,
        indexedAt: newest.indexedAt,
        firstIndexedAt: oldest.indexedAt,
        isRead: isNotificationRead(newest.indexedAt, seenAt),
        items: segment.events,
      }
    })
