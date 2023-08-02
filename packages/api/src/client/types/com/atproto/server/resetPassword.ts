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
  token: string
  password: string
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

export class ExpiredTokenError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class InvalidTokenError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export enum ErrorName {
  ExpiredToken = 'ExpiredToken',
  InvalidToken = 'InvalidToken',
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === ErrorName.ExpiredToken) return new ExpiredTokenError(e)
    if (e.error === ErrorName.InvalidToken) return new InvalidTokenError(e)
  }
  return e
}
