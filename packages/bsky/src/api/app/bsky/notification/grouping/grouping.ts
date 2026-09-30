import type { AtUriString, DatetimeString, DidString } from '@atproto/lex'
import type { NotificationsV2Algorithm } from '../../../../../config.js'
import {
  type Notification,
  NotificationFeed,
} from '../../../../../proto/bsky_pb.js'
import {
  type AppviewNotificationReason,
  type DataplaneNotificationReason,
  NOTIFICATION_REASON,
} from '../constants.js'
import { buildAlgoGravityGroups } from './algoGravity.js'
import { buildAlgoLookbackGroups } from './algoLookback.js'

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
      reason: DataplaneNotificationReasonWithSubject
      reasonSubject: AtUriString
    }
  | {
      reason: Exclude<
        DataplaneNotificationReason,
        DataplaneNotificationReasonWithSubject
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
}

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
    case NOTIFICATION_REASON.CONTACT_MATCH:
    case NOTIFICATION_REASON.FOLLOW:
    case NOTIFICATION_REASON.FOLLOW_BACK:
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

export const buildGroups = (
  items: NotificationItem[],
  limit: number,
  utcOffset: number,
  seenAt: number | undefined,
  algorithm: NotificationsV2Algorithm,
  feed = NotificationFeed.ALL,
): GroupingResult => {
  switch (algorithm) {
    case 'algoLookback':
      return buildAlgoLookbackGroups(items, limit, utcOffset, seenAt, feed)
    case 'algoGravity':
    default:
      return buildAlgoGravityGroups(items, limit, utcOffset, seenAt, feed)
  }
}
