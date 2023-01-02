/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { isObj, hasProp } from '../../../../util'

export interface QueryParams {
  /** The DID of the repo. */
  did: string
}

export type InputSchema = string | Uint8Array

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/cbor'
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
