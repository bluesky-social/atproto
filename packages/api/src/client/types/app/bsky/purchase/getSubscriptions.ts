/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  email?: string
  subscriptions: Subscription[]
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

export interface Subscription {
  status?: 'active' | 'expired' | 'paused' | 'unknown' | (string & {})
  renewalStatus?:
    | 'unknown'
    | 'will_not_renew'
    | 'will_pause'
    | 'will_renew'
    | (string & {})
  group?: 'core' | (string & {})
  platform?: 'android' | 'ios' | 'web' | (string & {})
  offering?: 'coreAnnual' | 'coreMonthly' | (string & {})
  periodEndsAt?: string
  periodStartsAt?: string
  purchasedAt?: string
  [k: string]: unknown
}

export function isSubscription(v: unknown): v is Subscription {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.purchase.getSubscriptions#subscription'
  )
}

export function validateSubscription(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.purchase.getSubscriptions#subscription', v)
}
