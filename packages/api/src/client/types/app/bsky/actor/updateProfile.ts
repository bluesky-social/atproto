/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export interface QueryParams {}

export interface InputSchema {
  did?: string
  displayName?: string
  description?: string
  avatar?: { cid: string; mimeType: string; [k: string]: unknown }
  banner?: { cid: string; mimeType: string; [k: string]: unknown }
  [k: string]: unknown
}

export interface OutputSchema {
  uri: string
  cid: string
  record: {}
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

export class InvalidBlobError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class BlobTooLargeError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class InvalidMimeTypeError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export class InvalidImageDimensionsError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidBlob') return new InvalidBlobError(e)
    if (e.error === 'BlobTooLarge') return new BlobTooLargeError(e)
    if (e.error === 'InvalidMimeType') return new InvalidMimeTypeError(e)
    if (e.error === 'InvalidImageDimensions')
      return new InvalidImageDimensionsError(e)
  }
  return e
}
