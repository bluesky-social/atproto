import type { DatetimeString, DidString } from '@atproto/lex'
import type { NotificationsV2Algorithm } from '../../../../../config.js'
import { NotificationFeed } from '../../../../../proto/bsky_pb.js'
import type { NotificationReason } from '../constants.js'
import { buildAlgoGravityGroups } from './algoGravity.js'
import { buildAlgoLookbackGroups } from './algoLookback.js'

export type NotificationGroupingEvent = {
  id: string
  kind: NotificationReason
  subject: string
  actorDid: DidString
  indexedAt: DatetimeString
}

export type NotificationGroup = {
  id: string
  kind: NotificationReason
  subject: string
  actorDids: DidString[]
  eventCount: number
  indexedAt: DatetimeString
  firstIndexedAt: DatetimeString
  isRead: boolean
  items: NotificationGroupingEvent[]
}

export const buildGroups = (
  events: NotificationGroupingEvent[],
  limit: number,
  utcOffset: number,
  seenAt: number | undefined,
  algorithm: NotificationsV2Algorithm,
  feed = NotificationFeed.ALL,
): { groups: NotificationGroup[]; cursor?: string } => {
  switch (algorithm) {
    case 'algoLookback':
      return buildAlgoLookbackGroups(events, limit, utcOffset, seenAt, feed)
    case 'algoGravity':
    default:
      return buildAlgoGravityGroups(events, limit, utcOffset, seenAt, feed)
  }
}
