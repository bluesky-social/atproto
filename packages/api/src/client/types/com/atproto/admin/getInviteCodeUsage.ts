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

export interface OutputSchema {
  total: CodesDetail
  user: CodesDetail
  admin: CodesDetail
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

export interface CodesDetail {
  count: number
  available: number
  used: number
  disabled: number
  [k: string]: unknown
}

export function isCodesDetail(v: unknown): v is CodesDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.getInviteCodeUsage#codesDetail'
  )
}

export function validateCodesDetail(v: unknown): ValidationResult {
  return lexicons.validate(
    'com.atproto.admin.getInviteCodeUsage#codesDetail',
    v,
  )
}
