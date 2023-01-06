/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorRef from '../actor/ref'

export interface QueryParams {
  limit?: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  notifications: Notification[]
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

export interface Notification {
  uri: string
  cid: string
  author: AppBskyActorRef.WithInfo
  /** Expected values are 'vote', 'repost', 'trend', 'follow', 'invite', 'mention' and 'reply'. */
  reason:
    | 'vote'
    | 'repost'
    | 'trend'
    | 'follow'
    | 'invite'
    | 'mention'
    | 'reply'
    | (string & {})
  reasonSubject?: string
  record: {}
  isRead: boolean
  indexedAt: string
  [k: string]: unknown
}

export function isNotification(v: unknown): v is Notification {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.notification.list#notification'
  )
}

export function validateNotification(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.notification.list#notification', v)
}
