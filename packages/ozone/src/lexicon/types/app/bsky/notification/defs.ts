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
  inApp: boolean
  push: boolean
}

const hashChannels = 'channels'

export function isChannels<V>(v: V) {
  return is$typed(v, id, hashChannels)
}

export function validateChannels<V>(v: V) {
  return validate<Channels & V>(v, id, hashChannels)
}

export interface Preference {
  $type?: 'app.bsky.notification.defs#preference'
  channels: Channels
  filter: 'all' | 'follows' | (string & {})
}

const hashPreference = 'preference'

export function isPreference<V>(v: V) {
  return is$typed(v, id, hashPreference)
}

export function validatePreference<V>(v: V) {
  return validate<Preference & V>(v, id, hashPreference)
}

export interface Preferences {
  $type?: 'app.bsky.notification.defs#preferences'
  likeNotification: Preference
  repostNotification: Preference
  followNotification: Preference
  replyNotification: Preference
  mentionNotification: Preference
  quoteNotification: Preference
  starterpackJoinedNotification: Preference
  verifiedNotification: Preference
  unverifiedNotification: Preference
  likeViaRepostNotification: Preference
  repostViaRepostNotification: Preference
  subscribedPostNotification: Preference
  chatNotification: Preference
}

const hashPreferences = 'preferences'

export function isPreferences<V>(v: V) {
  return is$typed(v, id, hashPreferences)
}

export function validatePreferences<V>(v: V) {
  return validate<Preferences & V>(v, id, hashPreferences)
}
