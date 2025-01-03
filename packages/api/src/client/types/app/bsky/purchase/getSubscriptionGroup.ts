/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {
  group: 'core' | (string & {})
  platform: 'android' | 'ios' | 'web' | (string & {})
}

export type InputSchema = undefined

export interface OutputSchema {
  group?: 'core' | (string & {})
  offerings?: Offering[]
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

export interface Offering {
  id?: 'core:annual' | 'core:monthly' | (string & {})
  platform?: 'android' | 'ios' | 'web' | (string & {})
  product?: string
  [k: string]: unknown
}

export function isOffering(v: unknown): v is Offering {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.purchase.getSubscriptionGroup#offering'
  )
}

export function validateOffering(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.purchase.getSubscriptionGroup#offering', v)
}
