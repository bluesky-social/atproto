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
  passwords: AppPassword[]
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

export class AccountTakedownError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AccountTakedown') return new AccountTakedownError(e)
  }
  return e
}

export interface AppPassword {
  name: string
  createdAt: string
  [k: string]: unknown
}

export function isAppPassword(v: unknown): v is AppPassword {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.server.listAppPasswords#appPassword'
  )
}

export function validateAppPassword(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.server.listAppPasswords#appPassword', v)
}
