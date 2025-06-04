/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.notification.defs'

export interface RecordDeleted {
  $type?: 'app.bsky.notification.defs#recordDeleted'
}

const hashRecordDeleted = 'recordDeleted'

export function isRecordDeleted<V>(v: V) {
  return is$typed(v, id, hashRecordDeleted)
}

export function validateRecordDeleted<V>(v: V) {
  return validate<RecordDeleted & V>(v, id, hashRecordDeleted)
}

export interface Channels {
  $type?: 'app.bsky.notification.defs#channels'
  list: boolean
  push: boolean
}

const hashChannels = 'channels'

export function isChannels<V>(v: V) {
  return is$typed(v, id, hashChannels)
}

export function validateChannels<V>(v: V) {
  return validate<Channels & V>(v, id, hashChannels)
}

export interface ChannelsPush {
  $type?: 'app.bsky.notification.defs#channelsPush'
  push: boolean
}

const hashChannelsPush = 'channelsPush'

export function isChannelsPush<V>(v: V) {
  return is$typed(v, id, hashChannelsPush)
}

export function validateChannelsPush<V>(v: V) {
  return validate<ChannelsPush & V>(v, id, hashChannelsPush)
}

export interface PreferenceFull {
  $type?: 'app.bsky.notification.defs#preferenceFull'
  channels: Channels
  filter: 'all' | 'follows' | (string & {})
}

const hashPreferenceFull = 'preferenceFull'

export function isPreferenceFull<V>(v: V) {
  return is$typed(v, id, hashPreferenceFull)
}

export function validatePreferenceFull<V>(v: V) {
  return validate<PreferenceFull & V>(v, id, hashPreferenceFull)
}

export interface PreferenceNoFilter {
  $type?: 'app.bsky.notification.defs#preferenceNoFilter'
  channels: Channels
}

const hashPreferenceNoFilter = 'preferenceNoFilter'

export function isPreferenceNoFilter<V>(v: V) {
  return is$typed(v, id, hashPreferenceNoFilter)
}

export function validatePreferenceNoFilter<V>(v: V) {
  return validate<PreferenceNoFilter & V>(v, id, hashPreferenceNoFilter)
}

export interface PreferencePush {
  $type?: 'app.bsky.notification.defs#preferencePush'
  channels: ChannelsPush
  filter: 'all' | 'follows' | (string & {})
}

const hashPreferencePush = 'preferencePush'

export function isPreferencePush<V>(v: V) {
  return is$typed(v, id, hashPreferencePush)
}

export function validatePreferencePush<V>(v: V) {
  return validate<PreferencePush & V>(v, id, hashPreferencePush)
}

export interface Preferences {
  $type?: 'app.bsky.notification.defs#preferences'
  chat: PreferencePush
  follow: PreferenceFull
  like: PreferenceFull
  likeViaRepost: PreferenceFull
  mention: PreferenceFull
  quote: PreferenceFull
  reply: PreferenceFull
  repost: PreferenceFull
  repostViaRepost: PreferenceFull
  starterpackJoined: PreferenceNoFilter
  subscribedPost: PreferenceNoFilter
  unverified: PreferenceNoFilter
  verified: PreferenceNoFilter
}

const hashPreferences = 'preferences'

export function isPreferences<V>(v: V) {
  return is$typed(v, id, hashPreferences)
}

export function validatePreferences<V>(v: V) {
  return validate<Preferences & V>(v, id, hashPreferences)
}
