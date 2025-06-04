import {
  Preference,
  Preferences,
} from '../../../../lexicon/types/app/bsky/notification/defs'
import { NotificationPreference } from '../../../../proto/bsky_pb'

type OptionalPreference = {
  channels?: {
    inApp?: boolean
    push?: boolean
  }
  filter?: NotificationPreference['filter']
}

type OptionalPreferences = {
  [Property in Extract<keyof Preferences, string>]?: OptionalPreference
}

const ensureNotificationPreference = (p?: OptionalPreference): Preference => {
  const filters: Preference['filter'][] = ['all', 'follows']
  const defaultChannels = { inApp: false, push: false }
  return {
    channels: p?.channels
      ? { ...defaultChannels, ...p.channels }
      : defaultChannels,
    filter: p?.filter && filters.includes(p.filter) ? p.filter : 'all',
  }
}

export const ensureNotificationPreferences = (
  p: OptionalPreferences,
): Preferences => {
  return {
    like: ensureNotificationPreference(p.like),
    repost: ensureNotificationPreference(p.repost),
    follow: ensureNotificationPreference(p.follow),
    reply: ensureNotificationPreference(p.reply),
    mention: ensureNotificationPreference(p.mention),
    quote: ensureNotificationPreference(p.quote),
    starterpackJoined: ensureNotificationPreference(p.starterpackJoined),
    verified: ensureNotificationPreference(p.verified),
    unverified: ensureNotificationPreference(p.unverified),
    likeViaRepost: ensureNotificationPreference(p.likeViaRepost),
    repostViaRepost: ensureNotificationPreference(p.repostViaRepost),
    subscribedPost: ensureNotificationPreference(p.subscribedPost),
    chat: ensureNotificationPreference(p.chat),
  }
}
