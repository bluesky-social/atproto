/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {
  sort?: 'recent' | 'usage' | (string & {})
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  codes: CodeDetail[]
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

export interface CodeDetail {
  code: string
  available: number
  disabled: boolean
  forAccount: string
  createdBy: string
  createdAt: string
  uses: CodeUse[]
  [k: string]: unknown
}

export function isCodeDetail(v: unknown): v is CodeDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.getInviteCodes#codeDetail'
  )
}

export function validateCodeDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.getInviteCodes#codeDetail', v)
}

export interface CodeUse {
  usedBy: string
  usedAt: string
  [k: string]: unknown
}

export function isCodeUse(v: unknown): v is CodeUse {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.getInviteCodes#codeUse'
  )
}

export function validateCodeUse(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.getInviteCodes#codeUse', v)
}
