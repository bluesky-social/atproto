import { Un$Typed } from '@atproto/api'
import {
  Channels,
  ChannelsPush,
  PreferenceFull,
  PreferenceNoFilter,
  PreferencePush,
  Preferences,
} from '../../../../lexicon/types/app/bsky/notification/defs'
import { GetNotificationPreferencesResponse } from '../../../../proto/bsky_pb'

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>
    }
  : T

type OptionalPreferenceFull = DeepPartial<PreferenceFull>
type OptionalPreferenceNoFilter = DeepPartial<PreferenceNoFilter>
type OptionalPreferencePush = DeepPartial<PreferencePush>

const filters = ['all', 'follows']
const defaultFilter = 'all'

const defaultChannels = { list: true, push: true }
const defaultChannelsPush = { push: true }

const ensureChannels = <T extends Un$Typed<Channels> | Un$Typed<ChannelsPush>>(
  fallback: T,
  p?:
    | OptionalPreferenceFull
    | OptionalPreferenceNoFilter
    | OptionalPreferencePush,
): T => (p?.channels ? { ...fallback, ...p.channels } : fallback)

const ensureFilter = (
  fallback: (typeof filters)[number],
  p?: OptionalPreferenceFull | OptionalPreferencePush,
) =>
  typeof p?.filter === 'string' && filters.includes(p.filter)
    ? p.filter
    : fallback

const ensurePreferenceFull = (p?: OptionalPreferenceFull): PreferenceFull => {
  return {
    channels: ensureChannels(defaultChannels, p),
    filter: ensureFilter(defaultFilter, p),
  }
}

const ensurePreferenceNoFilter = (
  p?: OptionalPreferenceNoFilter,
): PreferenceNoFilter => {
  return {
    channels: ensureChannels(defaultChannels, p),
  }
}

const ensurePreferencePush = (p?: OptionalPreferencePush): PreferencePush => {
  return {
    channels: ensureChannels(defaultChannelsPush, p),
    filter: ensureFilter(defaultFilter, p),
  }
}

export const ensurePreferences = (
  res: DeepPartial<GetNotificationPreferencesResponse>,
): Preferences => {
  return {
    chat: ensurePreferencePush(res.chat),
    follow: ensurePreferenceFull(res.follow),
    like: ensurePreferenceFull(res.like),
    likeViaRepost: ensurePreferenceFull(res.likeViaRepost),
    mention: ensurePreferenceFull(res.mention),
    quote: ensurePreferenceFull(res.quote),
    reply: ensurePreferenceFull(res.reply),
    repost: ensurePreferenceFull(res.repost),
    repostViaRepost: ensurePreferenceFull(res.repostViaRepost),
    starterpackJoined: ensurePreferenceNoFilter(res.starterpackJoined),
    subscribedPost: ensurePreferenceNoFilter(res.subscribedPost),
    unverified: ensurePreferenceNoFilter(res.unverified),
    verified: ensurePreferenceNoFilter(res.verified),
  }
}
