/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { isObj, hasProp } from '../../../../util.js'
import { lexicons } from '../../../../lexicons.js'
import * as AppBskyActorDefs from '../actor/defs.js'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js'

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
  [k: string]: unknown
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
  record: {}
  isRead: boolean
  indexedAt: string
  labels?: ComAtprotoLabelDefs.Label[]
  [k: string]: unknown
}

export function isNotification(v: unknown): v is Notification {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.notification.listNotifications#notification'
  )
}

export function validateNotification(v: unknown): ValidationResult {
  return lexicons.validate(
    'app.bsky.notification.listNotifications#notification',
    v,
  )
}
