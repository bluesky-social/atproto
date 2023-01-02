/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { isObj, hasProp } from '../../../../util'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {}

export interface InputSchema {
  handle: string
  recoveryKey?: string
  [k: string]: unknown
}

export interface OutputSchema {
  handle: string
  did: string
  declaration: AppBskySystemDeclRef.Main
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

export class InvalidHandleError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class HandleNotAvailableError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidHandle') return new InvalidHandleError(e)
    if (e.error === 'HandleNotAvailable') return new HandleNotAvailableError(e)
  }
  return e
}
