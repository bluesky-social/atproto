import { Un$Typed } from '@atproto/api'
import {
  ChatPreference,
  FilterablePreference,
  Preference,
  Preferences,
} from '../../../../lexicon/types/app/bsky/notification/defs'
import {
  ChatNotificationFilter,
  ChatNotificationPreference,
  FilterableNotificationPreference,
  NotificationFilter,
  NotificationPreference,
  NotificationPreferences,
} from '../../../../proto/bsky_pb'

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>
    }
  : T

const ensureChatPreference = (
  p?: DeepPartial<ChatPreference>,
): ChatPreference => {
  const filters = ['all', 'accepted']
  return {
    filter:
      typeof p?.filter === 'string' && filters.includes(p.filter)
        ? p.filter
        : 'all',
    push: p?.push ?? true,
  }
}

const ensureFilterablePreference = (
  p?: DeepPartial<FilterablePreference>,
): FilterablePreference => {
  const filters = ['all', 'follows']
  return {
    filter:
      typeof p?.filter === 'string' && filters.includes(p.filter)
        ? p.filter
        : 'all',
    list: p?.list ?? true,
    push: p?.push ?? true,
  }
}

const ensurePreference = (p?: DeepPartial<Preference>): Preference => {
  return {
    list: p?.list ?? true,
    push: p?.push ?? true,
  }
}

const ensurePreferences = (
  p: DeepPartial<Preferences>,
): Un$Typed<Preferences> => {
  return {
    chat: ensureChatPreference(p.chat),
    follow: ensureFilterablePreference(p.follow),
    like: ensureFilterablePreference(p.like),
    likeViaRepost: ensureFilterablePreference(p.likeViaRepost),
    mention: ensureFilterablePreference(p.mention),
    quote: ensureFilterablePreference(p.quote),
    reply: ensureFilterablePreference(p.reply),
    repost: ensureFilterablePreference(p.repost),
    repostViaRepost: ensureFilterablePreference(p.repostViaRepost),
    starterpackJoined: ensurePreference(p.starterpackJoined),
    subscribedPost: ensurePreference(p.subscribedPost),
    unverified: ensurePreference(p.unverified),
    verified: ensurePreference(p.verified),
  }
}

const protobufChatPreferenceToLex = (
  p?: DeepPartial<ChatNotificationPreference>,
): DeepPartial<ChatPreference> => {
  return {
    filter: p?.filter === ChatNotificationFilter.ACCEPTED ? 'accepted' : 'all',
    push: p?.push?.enabled,
  }
}

const protobufFilterablePreferenceToLex = (
  p?: DeepPartial<FilterableNotificationPreference>,
): DeepPartial<FilterablePreference> => {
  return {
    filter: p?.filter === NotificationFilter.FOLLOWS ? 'follows' : 'all',
    list: p?.list?.enabled,
    push: p?.push?.enabled,
  }
}

const protobufPreferenceToLex = (
  p?: DeepPartial<NotificationPreference>,
): DeepPartial<Preference> => {
  return {
    list: p?.list?.enabled,
    push: p?.push?.enabled,
  }
}

export const protobufToLex = (
  res: DeepPartial<NotificationPreferences>,
): Un$Typed<Preferences> => {
  return ensurePreferences({
    chat: protobufChatPreferenceToLex(res.chat),
    follow: protobufFilterablePreferenceToLex(res.follow),
    like: protobufFilterablePreferenceToLex(res.like),
    likeViaRepost: protobufFilterablePreferenceToLex(res.likeViaRepost),
    mention: protobufFilterablePreferenceToLex(res.mention),
    quote: protobufFilterablePreferenceToLex(res.quote),
    reply: protobufFilterablePreferenceToLex(res.reply),
    repost: protobufFilterablePreferenceToLex(res.repost),
    repostViaRepost: protobufFilterablePreferenceToLex(res.repostViaRepost),
    starterpackJoined: protobufPreferenceToLex(res.starterpackJoined),
    subscribedPost: protobufPreferenceToLex(res.subscribedPost),
    unverified: protobufPreferenceToLex(res.unverified),
    verified: protobufPreferenceToLex(res.verified),
  })
}
