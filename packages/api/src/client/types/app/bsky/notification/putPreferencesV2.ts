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
  likeNotification?: AppBskyNotificationDefs.Preference
  repostNotification?: AppBskyNotificationDefs.Preference
  followNotification?: AppBskyNotificationDefs.Preference
  replyNotification?: AppBskyNotificationDefs.Preference
  mentionNotification?: AppBskyNotificationDefs.Preference
  quoteNotification?: AppBskyNotificationDefs.Preference
  starterpackJoinedNotification?: AppBskyNotificationDefs.Preference
  verifiedNotification?: AppBskyNotificationDefs.Preference
  unverifiedNotification?: AppBskyNotificationDefs.Preference
  likeViaRepostNotification?: AppBskyNotificationDefs.Preference
  repostViaRepostNotification?: AppBskyNotificationDefs.Preference
  subscribedPostNotification?: AppBskyNotificationDefs.Preference
  chatNotification?: AppBskyNotificationDefs.Preference
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
}

export function toKnownErr(e: any) {
  return e
}
