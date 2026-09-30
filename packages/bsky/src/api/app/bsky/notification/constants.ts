// As they come from the dataplane.
export const NOTIFICATION_REASON = {
  CONTACT_MATCH: 'contact-match',
  FOLLOW: 'follow',
  FOLLOW_BACK: 'follow-back',
  LIKE: 'like',
  LIKE_VIA_REPOST: 'like-via-repost',
  MENTION: 'mention',
  QUOTE: 'quote',
  REPLY: 'reply',
  REPOST: 'repost',
  REPOST_VIA_REPOST: 'repost-via-repost',
  STARTERPACK_JOINED: 'starterpack-joined',
  SUBSCRIBED_POST: 'subscribed-post',
  UNVERIFIED: 'unverified',
  VERIFIED: 'verified',
} as const

export type DataplaneNotificationReason =
  (typeof NOTIFICATION_REASON)[keyof typeof NOTIFICATION_REASON]

export const APPVIEW_NOTIFICATION_REASON = {
  ...NOTIFICATION_REASON,
  MULTI_POST_LIKE: 'multi-post-like',
} as const

export type AppviewNotificationReason =
  | DataplaneNotificationReason
  | typeof APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE

// Not a real notification the users see, but used to mark as read across user devices.
export const MARK_READ_GENERIC = 'mark-read-generic'
