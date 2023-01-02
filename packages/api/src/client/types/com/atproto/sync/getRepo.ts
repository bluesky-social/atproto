/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export interface QueryParams {
  /** The DID of the repo. */
  did: string
  /** A past commit CID. */
  from?: string
}

export type InputSchema = undefined

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
