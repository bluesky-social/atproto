/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export interface QueryParams {
  /** The handle or DID of the repo. */
  user: string
  /** The NSID of the collection. */
  collection: string
  /** The key of the record. */
  rkey: string
  /** The CID of the version of the record. If not specified, then return the most recent version. */
  cid?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string
  cid?: string
  value: {}
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
