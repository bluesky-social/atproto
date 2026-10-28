import type { AtUriString, DatetimeString, DidString } from '@atproto/lex'
import type { NotificationsV2Algorithm } from '../../../../../config.js'
import type { Notification } from '../../../../../proto/bsky_pb.js'
import {
  type AppviewNotificationReason,
  type DataplaneNotificationReason,
  NOTIFICATION_REASON,
} from '../constants.js'
import { buildAlgoGravityGroups, splitGravityBursts } from './algoGravity.js'
import { buildAlgoLookbackGroups, splitLookbackBursts } from './algoLookback.js'

// Notification reasons that require reasonSubject to be non-empty.
// It should be the AT-URI of a record belonging to the notification recipient
type DataplaneNotificationReasonWithSubject =
  | typeof NOTIFICATION_REASON.LIKE
  | typeof NOTIFICATION_REASON.REPOST
  | typeof NOTIFICATION_REASON.LIKE_VIA_REPOST
  | typeof NOTIFICATION_REASON.REPOST_VIA_REPOST
  | typeof NOTIFICATION_REASON.REPLY
  | typeof NOTIFICATION_REASON.QUOTE
  | typeof NOTIFICATION_REASON.STARTERPACK_JOINED

// A dataplane notification that has passed our checks.
// We just don't use the underlying proto type because
// it has optional fields that we validate and ensure are present with this type.
export type RawNotification = {
  recipientDid: DidString
  uri: AtUriString
  indexedAt: DatetimeString
} & (
  | {
      // Cases that always have a reason subject.
      reason: DataplaneNotificationReasonWithSubject
      reasonSubject: AtUriString
    }
  | {
      // Cases that have optional reason subject.
      reason:
        | typeof NOTIFICATION_REASON.FOLLOW
        | typeof NOTIFICATION_REASON.FOLLOW_BACK
      reasonSubject: AtUriString | undefined
    }
  | {
      // Cases that never have a reason subject.
      reason: Exclude<
        DataplaneNotificationReason,
        | DataplaneNotificationReasonWithSubject
        | typeof NOTIFICATION_REASON.FOLLOW
        | typeof NOTIFICATION_REASON.FOLLOW_BACK
      >
      reasonSubject: undefined
    }
)

// NotificationItem contains the raw notification plus computed data from it,
// that will be used to calculate its grouping.
export type NotificationItem = {
  raw: RawNotification
  id: string
  groupingKey: string
  actorDid: DidString
  indexedTime: number
}

// Builds a NotificationItem, caching its parsed timestamp so grouping never re-parses it.
export const buildNotificationItem = (
  raw: RawNotification,
  id: string,
  groupingKey: string,
  actorDid: DidString,
): NotificationItem => ({
  raw,
  id,
  groupingKey,
  actorDid,
  indexedTime: Date.parse(raw.indexedAt),
})

// NotificationGroup is the grouping algorithm’s result: the notification items it grouped together,
// plus their count and timestamps, before Views builds the lexicon response.
export type NotificationGroup = {
  id: string
  kind: AppviewNotificationReason
  groupingKey: string
  actorDids: DidString[]
  itemCount: number
  indexedAt: DatetimeString
  firstIndexedAt: DatetimeString
  isRead: boolean
  items: NotificationItem[]
}

export type GroupingResult = {
  groups: NotificationGroup[]
  cursor?: string
}

export type BurstSplitter = (
  items: NotificationItem[],
  now: number,
  timeSpanMultiplier: number,
) => NotificationItem[][]

type GroupingAlgorithm = {
  buildGroups: typeof buildAlgoGravityGroups
  splitBursts: BurstSplitter
}

export function parseRawNotification(
  notification: Notification,
): RawNotification | undefined {
  const { recipientDid, uri, reason, reasonSubject, timestamp } = notification
  if (!recipientDid || !uri || !timestamp) return
  const indexedAt = timestamp.toJson() as string as DatetimeString

  switch (reason) {
    case NOTIFICATION_REASON.LIKE:
    case NOTIFICATION_REASON.REPOST:
    case NOTIFICATION_REASON.LIKE_VIA_REPOST:
    case NOTIFICATION_REASON.REPOST_VIA_REPOST:
    case NOTIFICATION_REASON.REPLY:
    case NOTIFICATION_REASON.QUOTE:
    case NOTIFICATION_REASON.STARTERPACK_JOINED:
      if (!reasonSubject) return
      return {
        recipientDid: recipientDid as DidString,
        uri: uri as AtUriString,
        reason,
        reasonSubject: reasonSubject as AtUriString,
        indexedAt,
      }
    case NOTIFICATION_REASON.FOLLOW:
    case NOTIFICATION_REASON.FOLLOW_BACK:
      return {
        recipientDid: recipientDid as DidString,
        uri: uri as AtUriString,
        reason,
        reasonSubject: reasonSubject
          ? (reasonSubject as AtUriString)
          : undefined,
        indexedAt,
      }
    case NOTIFICATION_REASON.CONTACT_MATCH:
    case NOTIFICATION_REASON.MENTION:
    case NOTIFICATION_REASON.SUBSCRIBED_POST:
    case NOTIFICATION_REASON.UNVERIFIED:
    case NOTIFICATION_REASON.VERIFIED:
      return {
        recipientDid: recipientDid as DidString,
        uri: uri as AtUriString,
        reason,
        reasonSubject: undefined,
        indexedAt,
      }
    default:
      return
  }
}

/** Select matching implementations for ordinary grouping and spotlight bursts. */
export const getGroupingAlgorithm = (
  algorithm: NotificationsV2Algorithm,
): GroupingAlgorithm => {
  switch (algorithm) {
    case 'algoLookback':
      return {
        buildGroups: buildAlgoLookbackGroups,
        splitBursts: splitLookbackBursts,
      }
    case 'algoGravity':
    default:
      return {
        buildGroups: buildAlgoGravityGroups,
        splitBursts: splitGravityBursts,
      }
  }
}
