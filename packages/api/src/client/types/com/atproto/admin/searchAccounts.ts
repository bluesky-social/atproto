/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface QueryParams {
  email?: string
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  accounts: AccountSearchResult[]
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

export interface AccountSearchResult {
  did: string
  email?: string
  normalizedEmail?: string
  handle?: string
  [k: string]: unknown
}

export function isAccountSearchResult(v: unknown): v is AccountSearchResult {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.searchAccounts#accountSearchResult'
  )
}

export function validateAccountSearchResult(v: unknown): ValidationResult {
  return lexicons.validate(
    'com.atproto.admin.searchAccounts#accountSearchResult',
    v,
  )
}
