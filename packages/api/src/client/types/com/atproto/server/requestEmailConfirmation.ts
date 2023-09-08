/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {}

export type InputSchema = undefined

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
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
