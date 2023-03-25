/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {}

export interface InputSchema {
  /** The handle or DID of the repo. */
  repo: string
  /** The NSID of the record collection. */
  collection: string
  /** The key of the record. */
  rkey?: string
  /** Validate the record? */
  validate?: boolean
  /** The record to create. */
  record: {}
  /** Compare and swap with the previous commit by cid. */
  swapCommit?: string
  [k: string]: unknown
}

export interface OutputSchema {
  uri: string
  cid: string
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
  data: OutputSchema
}

export class InvalidSwapError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidSwap') return new InvalidSwapError(e)
  }
  return e
}
