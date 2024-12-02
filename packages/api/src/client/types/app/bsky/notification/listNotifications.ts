/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorDefs from '../actor/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export const id = 'app.bsky.notification.listNotifications'

export interface QueryParams {
  limit?: number
  priority?: boolean
  cursor?: string
  seenAt?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  notifications: Notification[]
  priority?: boolean
  seenAt?: string
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

export interface Notification {
  $type?: $Type<'app.bsky.notification.listNotifications', 'notification'>
  uri: string
  cid: string
  author: AppBskyActorDefs.ProfileView
  /** Expected values are 'like', 'repost', 'follow', 'mention', 'reply', 'quote', and 'starterpack-joined'. */
  reason:
    | 'like'
    | 'repost'
    | 'follow'
    | 'mention'
    | 'reply'
    | 'quote'
    | 'starterpack-joined'
    | (string & {})
  reasonSubject?: string
  record: { [_ in string]: unknown }
  isRead: boolean
  indexedAt: string
  labels?: ComAtprotoLabelDefs.Label[]
}

export function isNotification<V>(v: V) {
  return is$typed(v, id, 'notification')
}

export function validateNotification(v: unknown) {
  return lexicons.validate(
    `${id}#notification`,
    v,
  ) as ValidationResult<Notification>
}

export function isValidNotification<V>(v: V): v is V & $Typed<Notification> {
  return isNotification(v) && validateNotification(v).success
}
