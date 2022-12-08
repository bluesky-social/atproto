/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'

export interface QueryParams {}

export type InputSchema = string | Uint8Array

export interface OutputSchema {
  cid: string
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: '*/*'
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export class InvalidBlobError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidBlob') return new InvalidBlobError(e)
  }
  return e
}
