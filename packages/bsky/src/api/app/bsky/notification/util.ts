import type { app } from '../../../../lexicons/index.js'
import {
  type FilterableNotificationPreference,
  NotificationInclude,
  type NotificationPreference,
  type NotificationPreferences,
} from '../../../../proto/bsky_pb.js'
import { AppPlatform } from '../../../../proto/courier_pb.js'

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>
    }
  : T

const ensureChatPreference = (
  p?: DeepPartial<app.bsky.notification.defs.ChatPreference>,
): app.bsky.notification.defs.ChatPreference => {
  const includeValues = ['all', 'accepted']
  return {
    include:
      typeof p?.include === 'string' && includeValues.includes(p.include)
        ? p.include
        : 'all',
    push: p?.push ?? true,
  }
}

const ensureFilterablePreference = (
  p?: DeepPartial<app.bsky.notification.defs.FilterablePreference>,
): app.bsky.notification.defs.FilterablePreference => {
  const includeValues = ['all', 'follows']
  return {
    include:
      typeof p?.include === 'string' && includeValues.includes(p.include)
        ? p.include
        : 'all',
    list: p?.list ?? true,
    push: p?.push ?? true,
  }
}

const ensurePreference = (
  p?: DeepPartial<app.bsky.notification.defs.Preference>,
): app.bsky.notification.defs.Preference => {
  return {
    list: p?.list ?? true,
    push: p?.push ?? true,
  }
}

const ensurePreferences = (
  p: DeepPartial<app.bsky.notification.defs.Preferences>,
): app.bsky.notification.defs.Preferences => {
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

export const DEFAULT_CHAT_PREFERENCE: app.bsky.notification.defs.ChatPreference =
  {
    include: 'all',
    push: true,
  }

const protobufFilterablePreferenceToLex = (
  p?: DeepPartial<FilterableNotificationPreference>,
): Partial<app.bsky.notification.defs.FilterablePreference> => {
  return {
    include: p?.include === NotificationInclude.FOLLOWS ? 'follows' : 'all',
    list: p?.list?.enabled,
    push: p?.push?.enabled,
  }
}

const protobufPreferenceToLex = (
  p?: DeepPartial<NotificationPreference>,
): Partial<app.bsky.notification.defs.Preference> => {
  return {
    list: p?.list?.enabled,
    push: p?.push?.enabled,
  }
}

export const protobufToLex = (
  res: DeepPartial<NotificationPreferences>,
): app.bsky.notification.defs.Preferences => {
  return ensurePreferences({
    // NOTE: See the deprecation notice on the lexicon. This field returns a static default value and shouldn't be used.
    // Use the chat.bsky.notification.defs#preferences type instead.
    chat: DEFAULT_CHAT_PREFERENCE,
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

type LexPlatform = 'ios' | 'android' | 'web'

export function assertLexPlatform(
  platform: string,
): asserts platform is LexPlatform {
  if (platform !== 'ios' && platform !== 'android' && platform !== 'web') {
    throw new Error('Unsupported platform: must be "ios", "android", or "web".')
  }
}

export const lexPlatformToProtoPlatform = (platform: string): AppPlatform =>
  platform === 'ios'
    ? AppPlatform.IOS
    : platform === 'android'
      ? AppPlatform.ANDROID
      : AppPlatform.WEB
