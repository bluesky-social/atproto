import { Timestamp } from '@bufbuild/protobuf'
import type { AtUriString, DidString } from '@atproto/syntax'
import { app } from '../../../../../lexicons/index.js'
import { Notification } from '../../../../../proto/bsky_pb.js'
import {
  APPVIEW_NOTIFICATION_REASON,
  type DataplaneNotificationReason,
  NOTIFICATION_REASON,
} from '../constants.js'
import {
  type NotificationItem,
  buildNotificationItem,
  parseRawNotification,
} from './grouping.js'

export const NOW = '2026-09-21T12:00:00.000Z'
export const now = Date.parse(NOW)
export function post(name: string): AtUriString {
  return `at://did:plc:viewer/${app.bsky.feed.post.$type}/${name}`
}

export function minutesAgo(minutes: number): string {
  return new Date(now - minutes * 60_000).toISOString()
}

export function item(
  id: string,
  indexedAt: string,
  kind: DataplaneNotificationReason = NOTIFICATION_REASON.LIKE,
  {
    actor = id,
    subject = post('main'),
  }: { actor?: string; subject?: AtUriString } = {},
): NotificationItem {
  const actorDid = `did:plc:${actor}` as DidString
  const collection =
    kind === NOTIFICATION_REASON.LIKE ||
    kind === NOTIFICATION_REASON.LIKE_VIA_REPOST
      ? app.bsky.feed.like.$type
      : kind === NOTIFICATION_REASON.FOLLOW ||
          kind === NOTIFICATION_REASON.FOLLOW_BACK
        ? app.bsky.graph.follow.$type
        : kind === NOTIFICATION_REASON.REPOST ||
            kind === NOTIFICATION_REASON.REPOST_VIA_REPOST
          ? app.bsky.feed.repost.$type
          : app.bsky.feed.post.$type
  const reasonSubjectRequired =
    kind === NOTIFICATION_REASON.LIKE ||
    kind === NOTIFICATION_REASON.REPOST ||
    kind === NOTIFICATION_REASON.LIKE_VIA_REPOST ||
    kind === NOTIFICATION_REASON.REPOST_VIA_REPOST ||
    kind === NOTIFICATION_REASON.REPLY ||
    kind === NOTIFICATION_REASON.QUOTE ||
    kind === NOTIFICATION_REASON.STARTERPACK_JOINED
  const raw = parseRawNotification(
    new Notification({
      recipientDid: 'did:plc:viewer',
      uri: `at://${actorDid}/${collection}/${id}`,
      reason: kind,
      ...(reasonSubjectRequired ? { reasonSubject: subject } : {}),
      timestamp: Timestamp.fromJson(indexedAt),
    }),
  )
  if (!raw) throw new Error('Invalid notification fixture')
  const groupingKey =
    kind === NOTIFICATION_REASON.FOLLOW ||
    kind === NOTIFICATION_REASON.SUBSCRIBED_POST
      ? kind
      : (raw.reasonSubject ?? raw.uri)
  return buildNotificationItem(raw, id, groupingKey, actorDid)
}

export const spotlightTypes = [
  {
    reason: NOTIFICATION_REASON.LIKE,
    kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
    collection: app.bsky.feed.post.$type,
  },
  {
    reason: NOTIFICATION_REASON.REPOST,
    kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_REPOST,
    collection: app.bsky.feed.post.$type,
  },
  {
    reason: NOTIFICATION_REASON.LIKE_VIA_REPOST,
    kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE_VIA_REPOST,
    collection: app.bsky.feed.repost.$type,
  },
  {
    reason: NOTIFICATION_REASON.REPOST_VIA_REPOST,
    kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_REPOST_VIA_REPOST,
    collection: app.bsky.feed.repost.$type,
  },
] as const
