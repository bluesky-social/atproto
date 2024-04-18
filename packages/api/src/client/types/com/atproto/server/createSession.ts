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
  /** Handle or other identifier supported by the server for the authenticating user. */
  identifier: string
  password: string
  authFactorToken?: string
  [k: string]: unknown
}

export interface OutputSchema {
  accessJwt: string
  refreshJwt: string
  handle: string
  did: string
  didDoc?: {}
  email?: string
  emailConfirmed?: boolean
  emailAuthFactor?: boolean
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

export class AccountTakedownError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export class AuthFactorTokenRequiredError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AccountTakedown') return new AccountTakedownError(e)
    if (e.error === 'AuthFactorTokenRequired')
      return new AuthFactorTokenRequiredError(e)
  }
  return e
}
