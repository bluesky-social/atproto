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
  codeCount: number
  useCount: number
  forAccounts?: string[]
  [k: string]: unknown
}

export interface OutputSchema {
  codes: AccountCodes[]
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

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

export interface AccountCodes {
  account: string
  codes: string[]
  [k: string]: unknown
}

export function isAccountCodes(v: unknown): v is AccountCodes {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.server.createInviteCodes#accountCodes'
  )
}

export function validateAccountCodes(v: unknown): ValidationResult {
  return lexicons.validate(
    'com.atproto.server.createInviteCodes#accountCodes',
    v,
  )
}
