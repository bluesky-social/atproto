import { DAY, MINUTE } from '@atproto/common'
import { NotificationFeed } from '../../../../../proto/bsky_pb.js'
import { NOTIFICATION_REASON, type NotificationReason } from '../constants.js'
import type { NotificationGroup } from './grouping.js'

export const MAX_GROUP_SIZE = 200

export const compareNotificationGroupsNewestFirst = (
  left: NotificationGroup,
  right: NotificationGroup,
): number => Date.parse(right.indexedAt) - Date.parse(left.indexedAt)

const GROUPABLE_KINDS = new Set<NotificationReason>([
  NOTIFICATION_REASON.FOLLOW,
  NOTIFICATION_REASON.LIKE,
  NOTIFICATION_REASON.LIKE_VIA_REPOST,
  NOTIFICATION_REASON.REPOST,
  NOTIFICATION_REASON.REPOST_VIA_REPOST,
  NOTIFICATION_REASON.SUBSCRIBED_POST,
])

export const canGroupNotification = (
  kind: NotificationReason,
  feed: NotificationFeed,
): boolean =>
  GROUPABLE_KINDS.has(kind) &&
  !(
    (kind === NOTIFICATION_REASON.FOLLOW &&
      feed === NotificationFeed.FOLLOWERS) ||
    (kind === NOTIFICATION_REASON.SUBSCRIBED_POST &&
      feed === NotificationFeed.ACTIVITY)
  )

export const localDay = (timestamp: number, utcOffset: number) =>
  Math.floor((timestamp + utcOffset * MINUTE) / DAY)

export const isNotificationRead = (
  indexedAt: string,
  seenAt: number | undefined,
) => seenAt !== undefined && Date.parse(indexedAt) < seenAt
