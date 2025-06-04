/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AppBskyNotificationDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.notification.putPreferencesV2'

export interface QueryParams {}

export interface InputSchema {
  chat?: AppBskyNotificationDefs.PreferencePush
  follow?: AppBskyNotificationDefs.PreferenceFull
  like?: AppBskyNotificationDefs.PreferenceFull
  likeViaRepost?: AppBskyNotificationDefs.PreferenceFull
  mention?: AppBskyNotificationDefs.PreferenceFull
  quote?: AppBskyNotificationDefs.PreferenceFull
  reply?: AppBskyNotificationDefs.PreferenceFull
  repost?: AppBskyNotificationDefs.PreferenceFull
  repostViaRepost?: AppBskyNotificationDefs.PreferenceFull
  starterpackJoined?: AppBskyNotificationDefs.PreferenceNoFilter
  subscribedPost?: AppBskyNotificationDefs.PreferenceNoFilter
  unverified?: AppBskyNotificationDefs.PreferenceNoFilter
  verified?: AppBskyNotificationDefs.PreferenceNoFilter
}

export interface OutputSchema {
  preferences: AppBskyNotificationDefs.Preferences
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}
