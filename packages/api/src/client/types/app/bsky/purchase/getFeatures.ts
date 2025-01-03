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
  features: Features
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

export interface Features {
  /** Indicates to client apps to allow the requesting account to customize the profile color. */
  customProfileColor?: boolean
  [k: string]: unknown
}

export function isFeatures(v: unknown): v is Features {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.purchase.getFeatures#features'
  )
}

export function validateFeatures(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.purchase.getFeatures#features', v)
}
