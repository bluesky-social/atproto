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
  like?: AppBskyNotificationDefs.Preference
  repost?: AppBskyNotificationDefs.Preference
  follow?: AppBskyNotificationDefs.Preference
  reply?: AppBskyNotificationDefs.Preference
  mention?: AppBskyNotificationDefs.Preference
  quote?: AppBskyNotificationDefs.Preference
  starterpackJoined?: AppBskyNotificationDefs.Preference
  verified?: AppBskyNotificationDefs.Preference
  unverified?: AppBskyNotificationDefs.Preference
  likeViaRepost?: AppBskyNotificationDefs.Preference
  repostViaRepost?: AppBskyNotificationDefs.Preference
  subscribedPost?: AppBskyNotificationDefs.Preference
  chat?: AppBskyNotificationDefs.Preference
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
