/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export interface QueryParams {
  /** The sequence number of the last seen repo update. */
  lastSeen: number
}

export interface CallOptions {
  headers?: Headers
}

export interface Response {
  success: boolean
  headers: Headers
  data: Uint8Array
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}
