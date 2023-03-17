/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export interface QueryParams {}

export interface InputSchema {
  /** The DID of the repo. */
  did: string
  /** The NSID of the record collection. */
  collection: string
  /** The key of the record. */
  rkey: string
  /** Compare and swap with the previous record by cid. */
  swapRecord?: string
  /** Compare and swap with the previous commit by cid. */
  swapCommit?: string
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/json'
}

export interface Response {
  success: boolean
  headers: Headers
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}
