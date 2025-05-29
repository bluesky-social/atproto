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

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.notification.listSubscriptions'

export interface QueryParams {
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  subscriptions: Subscription[]
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
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
  $type?: 'app.bsky.notification.listSubscriptions#subscription'
  subject: string
  activity: 'posts_no_replies' | 'posts_with_replies' | 'none' | (string & {})
}

const hashSubscription = 'subscription'

export function isSubscription<V>(v: V) {
  return is$typed(v, id, hashSubscription)
}

export function validateSubscription<V>(v: V) {
  return validate<Subscription & V>(v, id, hashSubscription)
}
