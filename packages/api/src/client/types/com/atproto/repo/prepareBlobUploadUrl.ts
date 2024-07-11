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
  /** Mimetype of the blob. */
  mimetype: string
  /** Size of the blob in bytes. */
  size: number
  /** Collection of the record that the blob is intended for. */
  collection: string
  [k: string]: unknown
}

export interface OutputSchema {
  url: string
  /** An opaque identifier string to be passed back in com.atproto.repo.finalizeBlobUpload. */
  uploadId: string
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
